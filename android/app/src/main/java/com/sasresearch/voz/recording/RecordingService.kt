package com.sasresearch.voz.recording

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import com.sasresearch.voz.data.PendingUpload
import com.sasresearch.voz.data.PendingUploads
import com.sasresearch.voz.upload.UploadWorker
import java.io.File
import java.util.UUID

/**
 * Servicio en primer plano que graba audio y sigue activo con la pantalla
 * bloqueada o la app minimizada (requisito de campo). Al detener, guarda el
 * archivo en la cola de subida y dispara el worker.
 *
 * Se controla con intents: ACTION_START (extras org_id, interview_id) y
 * ACTION_STOP.
 */
class RecordingService : Service() {

    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var orgId: String = ""
    private var interviewId: String = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                orgId = intent.getStringExtra(EXTRA_ORG_ID).orEmpty()
                interviewId = intent.getStringExtra(EXTRA_INTERVIEW_ID).orEmpty()
                startForeground(NOTIF_ID, buildNotification())
                startRecording()
            }
            ACTION_STOP -> {
                stopRecording()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun startRecording() {
        // Formato por defecto del dispositivo: MPEG-4 / AAC (.m4a), liviano.
        val dir = File(filesDir, "recordings").apply { mkdirs() }
        val file = File(dir, "${interviewId}_${System.currentTimeMillis()}.m4a")
        outputFile = file

        val rec = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(this) else @Suppress("DEPRECATION") MediaRecorder()
        rec.setAudioSource(MediaRecorder.AudioSource.MIC)
        rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        rec.setAudioEncodingBitRate(64000)
        rec.setAudioSamplingRate(16000)
        rec.setOutputFile(file.absolutePath)
        rec.prepare()
        rec.start()
        recorder = rec
    }

    private fun stopRecording() {
        try {
            recorder?.stop()
        } catch (_: Exception) {
            // Detener una grabación demasiado corta puede lanzar; se ignora.
        }
        recorder?.release()
        recorder = null

        val file = outputFile
        if (file != null && file.exists() && orgId.isNotEmpty() && interviewId.isNotEmpty()) {
            PendingUploads(this).add(
                PendingUpload(
                    id = UUID.randomUUID().toString(),
                    filePath = file.absolutePath,
                    orgId = orgId,
                    interviewId = interviewId,
                    createdAt = System.currentTimeMillis(),
                ),
            )
            UploadWorker.enqueue(this)
        }
        outputFile = null
    }

    private fun buildNotification(): Notification {
        val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Grabación", NotificationManager.IMPORTANCE_LOW)
            mgr.createNotificationChannel(channel)
        }
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Grabando entrevista")
            .setContentText("Entrevista $interviewId en curso")
            .setSmallIcon(android.R.drawable.presence_audio_online)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val ACTION_START = "com.sasresearch.voz.START"
        const val ACTION_STOP = "com.sasresearch.voz.STOP"
        const val EXTRA_ORG_ID = "org_id"
        const val EXTRA_INTERVIEW_ID = "interview_id"
        private const val CHANNEL_ID = "sas_voz_recording"
        private const val NOTIF_ID = 1001

        fun start(context: Context, orgId: String, interviewId: String) {
            val intent = Intent(context, RecordingService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_ORG_ID, orgId)
                putExtra(EXTRA_INTERVIEW_ID, interviewId)
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, RecordingService::class.java).apply { action = ACTION_STOP }
            context.startService(intent)
        }
    }
}
