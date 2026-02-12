import os
import json
import secrets
import logging
import hmac
import hashlib
import re
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError
import redis.asyncio as redis
from jose import jwt, JWTError


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("payment-api")


class Settings:
    MONGO_URI: str = os.getenv("MONGO_URI", "")
    DB_NAME: str = os.getenv("DB_NAME", "payment_gateway")
    REDIS_URI: str = os.getenv("REDIS_URI", "redis://localhost:6379/0")
    ADMIN_SECRET: str = os.getenv("ADMIN_SECRET", "")

    USER_CACHE_TTL_SEC: int = int(os.getenv("USER_CACHE_TTL_SEC", "300"))
    DASHBOARD_CACHE_TTL_SEC: int = int(os.getenv("DASHBOARD_CACHE_TTL_SEC", "10"))
    TX_HINT_TTL_SEC: int = int(os.getenv("TX_HINT_TTL_SEC", "900"))

    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    ENFORCE_SIGNATURE: bool = os.getenv("ENFORCE_SIGNATURE", "false").lower() == "true"

    TRUSTED_HOSTS: str = os.getenv("TRUSTED_HOSTS", "localhost,127.0.0.1")
    CORS_ALLOW_ORIGINS: str = os.getenv("CORS_ALLOW_ORIGINS", "*")

    APP_NAME: str = os.getenv("APP_NAME", "Payment Hybrid API")
    APP_VERSION: str = os.getenv("APP_VERSION", "6.0.0")

    def validate(self) -> None:
        if not self.MONGO_URI:
            raise ValueError("MONGO_URI is required")
        if not self.ADMIN_SECRET or len(self.ADMIN_SECRET) < 24:
            raise ValueError("ADMIN_SECRET must be at least 24 characters")
        if not self.JWT_SECRET_KEY or len(self.JWT_SECRET_KEY) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")


settings = Settings()
settings.validate()


TRX_ID_PATTERN = re.compile(r"^[A-Z0-9]{3,80}$")
SENDER_PATTERN = re.compile(r"^[A-Za-z0-9\s\-\.]{1,50}$")
PROVIDER_PATTERN = re.compile(r"^[a-z0-9\-]{2,30}$")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def generate_key(prefix: str, bytes_len: int) -> str:
    return f"{prefix}{secrets.token_hex(bytes_len)}"


def serialize_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "telegram_id": int(user["telegram_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "is_active": user.get("is_active", True),
        "subscription_end": user.get("subscription_end").isoformat() if user.get("subscription_end") else None,
        "device_key": user.get("device_key"),
        "api_key": user.get("api_key"),
        "created_at": user.get("created_at").isoformat() if user.get("created_at") else None,
        "updated_at": user.get("updated_at").isoformat() if user.get("updated_at") else None,
    }


def parse_cached_user(raw: Optional[str]) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    data = json.loads(raw)
    if "telegram_id" in data:
        data["telegram_id"] = int(data["telegram_id"])
    if data.get("subscription_end"):
        data["subscription_end"] = datetime.fromisoformat(data["subscription_end"])
    if data.get("created_at"):
        data["created_at"] = datetime.fromisoformat(data["created_at"])
    if data.get("updated_at"):
        data["updated_at"] = datetime.fromisoformat(data["updated_at"])
    return data


class Store:
    def __init__(self) -> None:
        self.mongo_client: Optional[AsyncIOMotorClient] = None
        self.redis_client: Optional[redis.Redis] = None
        self.db = None

    async def connect(self) -> None:
        self.mongo_client = AsyncIOMotorClient(
            settings.MONGO_URI,
            maxPoolSize=500,
            minPoolSize=30,
            retryWrites=True,
            serverSelectionTimeoutMS=5000,
        )
        await self.mongo_client.admin.command("ping")
        self.db = self.mongo_client[settings.DB_NAME]

        self.redis_client = await redis.from_url(
            settings.REDIS_URI,
            encoding="utf-8",
            decode_responses=True,
            max_connections=500,
            socket_timeout=2.0,
        )
        await self.redis_client.ping()

        await self.ensure_indexes()
        logger.info("Connected to MongoDB + Redis")

    async def disconnect(self) -> None:
        if self.mongo_client:
            self.mongo_client.close()
        if self.redis_client:
            await self.redis_client.close()
        logger.info("Connections closed")

    async def ensure_indexes(self) -> None:
        users = self.db["users"]
        tx = self.db["sms_transactions"]

        await users.create_index([("telegram_id", ASCENDING)], unique=True)
        await users.create_index([("api_key", ASCENDING)], unique=True)
        await users.create_index([("device_key", ASCENDING)], unique=True)
        await users.create_index([("is_active", ASCENDING)])
        await users.create_index([("subscription_end", ASCENDING)])

        await tx.create_index([("telegram_id", ASCENDING), ("trx_id", ASCENDING)], unique=True)
        await tx.create_index([("api_key", ASCENDING), ("trx_id", ASCENDING), ("amount_paisa", ASCENDING)])
        await tx.create_index([("api_key", ASCENDING), ("created_at", DESCENDING)])
        await tx.create_index([("created_at", ASCENDING)])


store = Store()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await store.connect()
    yield
    await store.disconnect()


app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION, lifespan=lifespan)

trusted_hosts = [h.strip() for h in settings.TRUSTED_HOSTS.split(",") if h.strip()]
app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)

if settings.CORS_ALLOW_ORIGINS.strip() == "*":
    cors_origins = ["*"]
else:
    cors_origins = [o.strip() for o in settings.CORS_ALLOW_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


async def cache_user(user: Dict[str, Any]) -> None:
    payload = serialize_user(user)
    encoded = json.dumps(payload)
    await store.redis_client.setex(f"user:api:{user['api_key']}", settings.USER_CACHE_TTL_SEC, encoded)
    await store.redis_client.setex(f"user:tg:{user['telegram_id']}", settings.USER_CACHE_TTL_SEC, encoded)
    await store.redis_client.setex(f"user:device:{user['device_key']}", settings.USER_CACHE_TTL_SEC, encoded)


async def invalidate_user_cache(user: Dict[str, Any]) -> None:
    keys = [
        f"user:api:{user.get('api_key')}",
        f"user:tg:{user.get('telegram_id')}",
        f"user:device:{user.get('device_key')}",
        f"dashboard:{user.get('api_key')}",
    ]
    await store.redis_client.delete(*keys)


async def get_user_by_api_key(api_key: str) -> Dict[str, Any]:
    cached = parse_cached_user(await store.redis_client.get(f"user:api:{api_key}"))
    if cached:
        return cached
    user = await store.db["users"].find_one({"api_key": api_key}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    await cache_user(user)
    return user


async def get_user_by_device_key(device_key: str) -> Dict[str, Any]:
    cached = parse_cached_user(await store.redis_client.get(f"user:device:{device_key}"))
    if cached:
        return cached
    user = await store.db["users"].find_one({"device_key": device_key}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid device key")
    await cache_user(user)
    return user


async def require_admin(x_admin_secret: str) -> None:
    if x_admin_secret != settings.ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret")


def ensure_user_active(user: Dict[str, Any]) -> None:
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="User is inactive")
    sub_end = user.get("subscription_end")
    if sub_end and sub_end < now_utc():
        raise HTTPException(status_code=403, detail="Subscription expired")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = now_utc() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


async def get_current_user_from_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        telegram_id = payload.get("sub")
        if telegram_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await store.db["users"].find_one({"telegram_id": int(telegram_id)}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def verify_signature(request: Request, user: Dict[str, Any]) -> None:
    if not settings.ENFORCE_SIGNATURE:
        return

    signature = request.headers.get("X-Signature")
    timestamp = request.headers.get("X-Timestamp")
    nonce = request.headers.get("X-Nonce")

    if not signature or not timestamp or not nonce:
        raise HTTPException(status_code=401, detail="Missing signature headers")

    try:
        ts = int(timestamp)
        if abs(now_utc().timestamp() - ts) > 300:
            raise HTTPException(status_code=401, detail="Timestamp out of range")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid timestamp")

    nonce_key = f"nonce:{user['telegram_id']}:{nonce}"
    if await store.redis_client.exists(nonce_key):
        raise HTTPException(status_code=401, detail="Nonce already used")
    await store.redis_client.setex(nonce_key, 300, "1")

    body = await request.body()
    message = f"{timestamp}{nonce}{body.decode('utf-8', errors='ignore')}".encode()
    expected_sig = hmac.new(user["device_key"].encode(), message, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")


class CreateUserIn(BaseModel):
    telegram_id: int = Field(..., gt=0)
    name: Optional[str] = Field(None, max_length=120)
    email: Optional[str] = Field(None, max_length=190)
    subscription_days: int = Field(30, gt=0, le=3650)


class UpdateUserIn(BaseModel):
    name: Optional[str] = Field(None, max_length=120)
    email: Optional[str] = Field(None, max_length=190)
    is_active: Optional[bool] = None


class AppSmsTransactionIn(BaseModel):
    provider: str = Field(..., min_length=2, max_length=30)
    sender: str = Field(..., min_length=1, max_length=50)
    message: str = Field(..., min_length=5, max_length=1000)
    amount_paisa: int = Field(..., gt=0)
    trx_id: str = Field(..., min_length=3, max_length=80)

    @validator("trx_id")
    def validate_trx_id(cls, v):
        v = v.strip().upper()
        if not TRX_ID_PATTERN.match(v):
            raise ValueError("Invalid transaction ID format")
        return v

    @validator("sender")
    def validate_sender(cls, v):
        v = v.strip()
        if not SENDER_PATTERN.match(v):
            raise ValueError("Invalid sender format")
        return v

    @validator("provider")
    def validate_provider(cls, v):
        v = v.lower().strip()
        if not PROVIDER_PATTERN.match(v):
            raise ValueError("Invalid provider format")
        return v


class VerifyPaymentIn(BaseModel):
    trx_id: str = Field(..., min_length=3, max_length=80)
    amount_paisa: int = Field(..., gt=0)

    @validator("trx_id")
    def validate_trx_id(cls, v):
        v = v.strip().upper()
        if not TRX_ID_PATTERN.match(v):
            raise ValueError("Invalid transaction ID format")
        return v


class ExtendSubscriptionIn(BaseModel):
    days: int = Field(..., gt=0, le=3650)


class SetSubscriptionEndIn(BaseModel):
    subscription_end: datetime


class UpdateApiKeyIn(BaseModel):
    telegram_id: int = Field(..., gt=0)


class UpdateTelegramIdIn(BaseModel):
    old_telegram_id: int = Field(..., gt=0)
    new_telegram_id: int = Field(..., gt=0)


class UpdateDeviceKeyIn(BaseModel):
    telegram_id: int = Field(..., gt=0)


class LoginRequest(BaseModel):
    device_key: str = Field(..., min_length=10, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@app.get("/")
async def root():
    return {"ok": True, "app": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/health")
async def health_check():
    try:
        await store.mongo_client.admin.command("ping")
        await store.redis_client.ping()
        return {"ok": True, "status": "healthy", "time": now_utc().isoformat()}
    except Exception as e:
        logger.error("Health check failed: %s", e)
        return JSONResponse(
            status_code=503,
            content={"ok": False, "status": "unhealthy", "error": str(e), "time": now_utc().isoformat()},
        )


@app.post("/api/v1/auth/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    user = await get_user_by_device_key(data.device_key)
    ensure_user_active(user)
    access_token = create_access_token(data={"sub": str(user["telegram_id"])})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/v1/sms")
async def submit_sms_transaction(
    request: Request,
    data: AppSmsTransactionIn,
    authorization: Optional[str] = Header(None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = authorization.split(" ", 1)[1].strip()
    user = await get_current_user_from_token(token)
    ensure_user_active(user)
    await verify_signature(request, user)

    tx_doc = {
        "telegram_id": user["telegram_id"],
        "api_key": user["api_key"],
        "provider": data.provider,
        "sender": data.sender,
        "message": data.message.strip(),
        "amount_paisa": int(data.amount_paisa),
        "trx_id": data.trx_id,
        "created_at": now_utc(),
    }

    try:
        await store.db["sms_transactions"].insert_one(tx_doc)
    except DuplicateKeyError:
        return {"ok": True, "status": "duplicate"}

    await store.redis_client.setex(
        f"tx:{user['api_key']}:{tx_doc['trx_id']}:{tx_doc['amount_paisa']}",
        settings.TX_HINT_TTL_SEC,
        "1",
    )
    await store.redis_client.delete(f"dashboard:{user['api_key']}")
    return {"ok": True, "status": "saved"}


@app.post("/api/admin/users")
async def create_user(data: CreateUserIn, x_admin_secret: str = Header(...)):
    await require_admin(x_admin_secret)
    now = now_utc()
    user_doc = {
        "telegram_id": data.telegram_id,
        "name": data.name,
        "email": data.email,
        "api_key": generate_key("API_", 20),
        "device_key": generate_key("DEV_", 16),
        "subscription_end": now + timedelta(days=data.subscription_days),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    try:
        await store.db["users"].insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="User already exists")
    await cache_user(user_doc)
    return {"ok": True, "user": serialize_user(user_doc)}


@app.delete("/api/admin/users/{telegram_id}")
async def delete_user(telegram_id: int, x_admin_secret: str = Header(...)):
    await require_admin(x_admin_secret)
    user = await store.db["users"].find_one({"telegram_id": telegram_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await store.db["users"].delete_one({"telegram_id": telegram_id})
    await store.db["sms_transactions"].delete_many({"telegram_id": telegram_id})
    await invalidate_user_cache(user)
    return {"ok": True, "message": "User and all transactions deleted"}


@app.patch("/api/admin/users/{telegram_id}")
async def update_user(telegram_id: int, data: UpdateUserIn, x_admin_secret: str = Header(...)):
    await require_admin(x_admin_secret)
    old_user = await store.db["users"].find_one({"telegram_id": telegram_id}, {"_id": 0})
    if not old_user:
        raise HTTPException(status_code=404, detail="User not found")
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = now_utc()
    user = await store.db["users"].find_one_and_update(
        {"telegram_id": telegram_id},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    await invalidate_user_cache(old_user)
    await cache_user(user)
    return {"ok": True, "user": serialize_user(user)}


@app.post("/api/admin/users/update-api-key")
async def update_user_api_key(data: UpdateApiKeyIn, x_admin_secret: str = Header(...)):
    await require_admin(x_admin_secret)
    old_user = await store.db["users"].find_one({"telegram_id": data.telegram_id}, {"_id": 0})
    if not old_user:
        raise HTTPException(status_code=404, detail="User not found")
    new_key = generate_key("API_", 20)
    user = await store.db["users"].find_one_and_update(
        {"telegram_id": data.telegram_id},
        {"$set": {"api_key": new_key, "updated_at": now_utc()}},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    await invalidate_user_cache(old_user)
    await cache_user(user)
    return {"ok": True, "api_key": user["api_key"]}


@app.post("/api/admin/users/update-telegram-id")
async def update_telegram_id(data: UpdateTelegramIdIn, x_admin_secret: str = Header(...)):
    await require_admin(x_admin_secret)
    old_user = await store.db["users"].find_one({"telegram_id": data.old_telegram_id}, {"_id": 0})
    if not old_user:
        raise HTTPException(status_code=404, detail="User not found")
    user = await store.db["users"].find_one_and_update(
        {"telegram_id": data.old_telegram_id},
        {"$set": {"telegram_id": data.new_telegram_id, "updated_at": now_utc()}},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    await invalidate_user_cache(old_user)
    await cache_user(user)
    return {"ok": True, "user": serialize_user(user)}


@app.post("/api/admin/users/extend-subscription/{telegram_id}")
async def extend_subscription(telegram_id: int, data: ExtendSubscriptionIn, x_admin_secret: str = Header(...)):
    await require_admin(x_admin_secret)
    user = await store.db["users"].find_one({"telegram_id": telegram_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    base_date = user.get("subscription_end") or now_utc()
    if base_date < now_utc():
        base_date = now_utc()
    new_end = base_date + timedelta(days=data.days)
    user = await store.db["users"].find_one_and_update(
        {"telegram_id": telegram_id},
        {"$set": {"subscription_end": new_end, "updated_at": now_utc()}},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    await cache_user(user)
    return {"ok": True, "subscription_end": user["subscription_end"].isoformat()}


@app.post("/api/admin/users/set-subscription-end/{telegram_id}")
async def set_subscription_end(telegram_id: int, data: SetSubscriptionEndIn, x_admin_secret: str = Header(...)):
    await require_admin(x_admin_secret)
    user = await store.db["users"].find_one_and_update(
        {"telegram_id": telegram_id},
        {"$set": {"subscription_end": data.subscription_end, "updated_at": now_utc()}},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await cache_user(user)
    return {"ok": True, "subscription_end": user["subscription_end"].isoformat()}


@app.post("/api/admin/users/update-device-key")
async def update_device_key(data: UpdateDeviceKeyIn, x_admin_secret: str = Header(...)):
    await require_admin(x_admin_secret)
    old_user = await store.db["users"].find_one({"telegram_id": data.telegram_id}, {"_id": 0})
    if not old_user:
        raise HTTPException(status_code=404, detail="User not found")
    user = await store.db["users"].find_one_and_update(
        {"telegram_id": data.telegram_id},
        {"$set": {"device_key": generate_key("DEV_", 16), "updated_at": now_utc()}},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    await invalidate_user_cache(old_user)
    await cache_user(user)
    return {"ok": True, "device_key": user["device_key"]}


@app.post("/api/v1/verify-payment")
async def verify_payment(req: VerifyPaymentIn, x_api_key: str = Header(...)):
    user = await get_user_by_api_key(x_api_key)
    ensure_user_active(user)

    trx_id = req.trx_id
    amt = int(req.amount_paisa)

    trx = await store.db["sms_transactions"].find_one_and_delete(
        {"api_key": x_api_key, "trx_id": trx_id, "amount_paisa": amt},
        projection={"_id": 0},
    )

    if not trx:
        raise HTTPException(status_code=404, detail="Transaction not found or already consumed")

    await store.redis_client.delete(f"tx:{x_api_key}:{trx_id}:{amt}")
    await store.redis_client.delete(f"dashboard:{x_api_key}")

    return {
        "ok": True,
        "message": "Payment verified and consumed",
        "transaction": {
            "trx_id": trx["trx_id"],
            "amount_paisa": trx["amount_paisa"],
            "provider": trx["provider"],
            "created_at": trx["created_at"].isoformat(),
        },
    }


@app.get("/api/v1/user/dashboard")
async def user_dashboard(x_api_key: str = Header(...)):
    cache_key = f"dashboard:{x_api_key}"
    cached = await store.redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    user = await get_user_by_api_key(x_api_key)
    ensure_user_active(user)

    tx_collection = store.db["sms_transactions"]
    pending_count = await tx_collection.count_documents({"api_key": x_api_key})

    latest = await tx_collection.find(
        {"api_key": x_api_key},
        {"_id": 0, "message": 0},
    ).sort("created_at", -1).limit(10).to_list(length=10)

    for item in latest:
        item["created_at"] = item["created_at"].isoformat()

    response = {
        "ok": True,
        "user": {
            "telegram_id": user["telegram_id"],
            "name": user.get("name"),
            "is_active": user.get("is_active", True),
            "subscription_end": user["subscription_end"].isoformat() if user.get("subscription_end") else None,
        },
        "stats": {"pending_transactions": pending_count},
        "latest_transactions": latest,
    }

    await store.redis_client.setex(cache_key, settings.DASHBOARD_CACHE_TTL_SEC, json.dumps(response))
    return response


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"ok": False, "error": exc.detail, "time": now_utc().isoformat()},
    )


@app.exception_handler(Exception)
async def unhandled_error(_: Request, exc: Exception):
    logger.exception("Unhandled server error: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"ok": False, "error": "Internal server error", "time": now_utc().isoformat()},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), workers=1)