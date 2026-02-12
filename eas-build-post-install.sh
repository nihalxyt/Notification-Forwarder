#!/bin/bash
echo "Paylite: Post-install hook running..."

# Force newArchEnabled in gradle.properties after prebuild
if [ -d "android" ]; then
  GRADLE_PROPS="android/gradle.properties"
  if [ -f "$GRADLE_PROPS" ]; then
    if grep -q "newArchEnabled" "$GRADLE_PROPS"; then
      sed -i 's/newArchEnabled=.*/newArchEnabled=true/' "$GRADLE_PROPS"
    else
      echo "newArchEnabled=true" >> "$GRADLE_PROPS"
    fi
    echo "Paylite: newArchEnabled set to true in gradle.properties"
    grep "newArchEnabled" "$GRADLE_PROPS"
  else
    echo "Paylite: gradle.properties not found yet (will be created during prebuild)"
  fi
fi
