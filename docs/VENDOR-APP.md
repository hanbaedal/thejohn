# 더존 업체 전용 Android 앱

업체가 로그인해 **사업부문(주문)·장바구니**를 쓰는 Android APK입니다.  
앱은 [thejohn.co.kr](https://www.thejohn.co.kr) 홈페이지를 WebView로 열어, 웹 수정 시 앱 재배포 없이 반영됩니다.

## 사전 준비

- Node.js 18+
- Android Studio + Android SDK (API 34 권장)
- `ANDROID_HOME` 또는 `%LOCALAPPDATA%\Android\Sdk`

## debug APK 빌드 (테스트용)

```powershell
cd vendor-app
npm install
npx cap add android
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

생성 파일:

`vendor-app/android/app/build/outputs/apk/debug/app-debug.apk`

## release APK (업체 배포용)

1. keystore 생성 (1회):

```powershell
keytool -genkey -v -keystore thejohn-vendor.keystore -alias thejohn-vendor -keyalg RSA -keysize 2048 -validity 10000
```

2. `vendor-app/android/keystore.properties` (Git에 올리지 마세요)

3. signingConfigs 설정 후 `.\gradlew.bat assembleRelease`

## 앱 동작

- 시작 URL: `login.html?app=vendor`
- 업체 로그인 후 → **사업부문(products.html)**
- 등록된 업체(`vendors`) 계정만 주문·장바구니 이용
- 로그인 세션은 앱에서 localStorage로 유지
