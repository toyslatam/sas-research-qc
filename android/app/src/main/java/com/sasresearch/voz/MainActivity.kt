package com.sasresearch.voz

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.sasresearch.voz.data.ApiClient
import com.sasresearch.voz.data.Org
import com.sasresearch.voz.data.PendingUploads
import com.sasresearch.voz.data.Session
import com.sasresearch.voz.recording.RecordingService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// Paleta de marca (violeta), a juego con el módulo web "Verificación de Voz".
private val VozColorScheme = lightColorScheme(
    primary = Color(0xFF7C3AED),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFEDE9FE),
    onPrimaryContainer = Color(0xFF3B0A99),
    secondary = Color(0xFF6D28D9),
    background = Color(0xFFFBFAFF),
    surface = Color(0xFFFFFFFF),
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = VozColorScheme) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val session = remember { Session(this) }
                    var loggedIn by remember { mutableStateOf(session.isLoggedIn) }
                    if (loggedIn) {
                        MainScreen(session, onLogout = { session.clear(); loggedIn = false })
                    } else {
                        LoginScreen(session, onLoggedIn = { loggedIn = true })
                    }
                }
            }
        }
    }
}

@Composable
private fun LoginScreen(session: Session, onLoggedIn: () -> Unit) {
    var email by remember { mutableStateOf(session.email ?: "") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("SAS Voz — Encuestador", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(email, { email = it }, label = { Text("Correo") }, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            password, { password = it },
            label = { Text("Contraseña") },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(16.dp))
        Button(
            enabled = !busy && email.isNotBlank() && password.isNotBlank(),
            onClick = {
                busy = true
                error = null
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) {
                            val token = ApiClient.login(email.trim(), password)
                            session.token = token
                            session.email = email.trim()
                            session.saveOrgs(ApiClient.listOrgs(token))
                        }
                        onLoggedIn()
                    } catch (e: Exception) {
                        error = e.message ?: "No se pudo iniciar sesión"
                    } finally {
                        busy = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (busy) "Entrando…" else "Entrar") }
        error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun MainScreen(session: Session, onLogout: () -> Unit) {
    val context = LocalContext.current
    val orgs = remember { session.orgs() }
    var org by remember { mutableStateOf(orgs.firstOrNull()) }
    var orgMenu by remember { mutableStateOf(false) }
    var interviewId by remember { mutableStateOf("") }
    var recording by remember { mutableStateOf(false) }
    var pending by remember { mutableStateOf(PendingUploads(context).count()) }
    var error by remember { mutableStateOf<String?>(null) }

    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { /* si se niega el micrófono, startRecording lo reflejará */ }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Text("Grabar entrevista", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(16.dp))

        // Organización
        OutlinedButton(onClick = { orgMenu = true }, enabled = !recording) {
            Text(org?.let { "${it.name} (${it.role})" } ?: "Sin organización")
        }
        DropdownMenu(expanded = orgMenu, onDismissRequest = { orgMenu = false }) {
            orgs.forEach { o ->
                DropdownMenuItem(text = { Text("${o.name} (${o.role})") }, onClick = {
                    org = o
                    orgMenu = false
                })
            }
        }

        Spacer(Modifier.height(16.dp))
        OutlinedTextField(
            interviewId, { interviewId = it },
            label = { Text("ID de la entrevista *") },
            enabled = !recording,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(24.dp))
        if (!recording) {
            Button(
                enabled = org != null && interviewId.isNotBlank(),
                onClick = {
                    error = null
                    val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        perms.add(Manifest.permission.POST_NOTIFICATIONS)
                    }
                    permLauncher.launch(perms.toTypedArray())
                    RecordingService.start(context, org!!.id, interviewId.trim())
                    recording = true
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("● Iniciar grabación") }
        } else {
            Button(
                onClick = {
                    RecordingService.stop(context)
                    recording = false
                    interviewId = ""
                    pending = PendingUploads(context).count()
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("■ Detener y guardar") }
        }

        error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }

        Spacer(Modifier.height(24.dp))
        Text("Pendientes de subir: $pending", style = MaterialTheme.typography.bodyMedium)
        Text(
            "Las grabaciones se guardan aunque no haya Internet y se suben solas al recuperar conexión.",
            style = MaterialTheme.typography.bodySmall,
        )

        Spacer(Modifier.height(32.dp))
        OutlinedButton(onClick = onLogout, enabled = !recording) { Text("Cerrar sesión") }
    }
}
