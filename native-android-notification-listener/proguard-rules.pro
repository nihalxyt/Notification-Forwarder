# ============================================
# Paylite Production ProGuard/R8 Rules
# Maximum obfuscation + optimization
# ============================================

# React Native core
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.**

# Expo modules
-keep class expo.modules.** { *; }
-dontwarn expo.modules.**

# Paylite NotificationListenerService (must be accessible)
-keep class com.paylite.app.PaymentNotificationListener { *; }
-keep class com.paylite.app.PaymentNotificationListener$* { *; }

# Keep annotation
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable
-keepattributes Exceptions

# Serialization
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# OkHttp + networking
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Crypto
-keep class javax.crypto.** { *; }
-keep class java.security.** { *; }

# Remove logging in production
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
    public static int i(...);
}

# Aggressive optimizations
-optimizationpasses 5
-allowaccessmodification
-repackageclasses ''
-overloadaggressively
-mergeinterfacesaggressively

# Remove unused code
-dontwarn javax.**
-dontwarn org.xmlpull.**
-dontwarn sun.misc.**
