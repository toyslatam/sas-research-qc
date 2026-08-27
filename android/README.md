# SAS Voz — App Android del encuestador (Etapa C)

App nativa (Kotlin + Jetpack Compose) para que los encuestadores graben
entrevistas en campo y las suban al mismo backend `/api/voice` que usa la web.

> **Estado: andamiaje sin compilar.** Este código se escribió sin un entorno
> Android (no había SDK/Android Studio para verificarlo). Ábrelo en Android
> Studio, corre el build, y es probable que haya que ajustar alguna versión o
> import. Es un punto de partida sólido, no un APK terminado.

## Qué hace

- **Login** con correo/clave (Supabase Auth) → guarda el token.
- **Grabar**: elegir organización, escribir el **ID de entrevista** (obligatorio),
  iniciar/detener. Graba en **m4a/AAC** (formato por defecto del dispositivo).
- **Foreground service**: la grabación sigue con la pantalla bloqueada o la app
  minimizada, con notificación persistente.
- **Offline**: la grabación se guarda localmente; si no hay Internet queda
  pendiente y se sube sola al recuperar conexión (WorkManager). Nunca se pierde.

## Configurar antes de compilar

En `gradle.properties` (o en `~/.gradle/gradle.properties`) rellena:

```
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=eyJ...   # anon key (pública), NUNCA la service_role
API_BASE_URL=https://powerbiresearch.online
```

## Compilar

1. Abrir la carpeta `android/` en **Android Studio** (Giraffe o superior).
2. Dejar que sincronice Gradle (descargará el wrapper y las dependencias).
3. Conectar un teléfono (o emulador) y **Run**.

Por línea de comandos (si tienes el SDK y el wrapper): `./gradlew assembleDebug`.

## Estructura

```
app/src/main/java/com/sasresearch/voz/
├── MainActivity.kt              UI Compose: login + grabación
├── data/
│   ├── ApiClient.kt             login (Supabase) + listar orgs + subir (OkHttp)
│   ├── Session.kt               token + orgs persistidos
│   └── PendingUploads.kt        cola offline
├── recording/
│   └── RecordingService.kt      foreground service + MediaRecorder
└── upload/
    └── UploadWorker.kt          subida con reintentos (WorkManager)
```

## Notas / pendientes conocidos

- **Icono**: usa el del sistema por defecto (no se incluyeron mipmaps).
- **Grabación de llamadas**: NO se implementa (Android lo restringe). Solo
  micrófono de la app, como se acordó.
- El estado "grabando" es local a la pantalla; si el proceso muere, la
  notificación permite detener. Una siguiente iteración puede vincular la UI al
  servicio para reflejar el estado real siempre.
- El indicador de "pendientes" se refresca al detener; se puede mejorar con un
  observador de WorkManager.
