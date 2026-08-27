package com.sasresearch.voz.upload

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.sasresearch.voz.data.ApiClient
import com.sasresearch.voz.data.PendingUploads
import com.sasresearch.voz.data.Session
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Sube las grabaciones pendientes cuando hay red. Corre en segundo plano; si una
 * falla, WorkManager reintenta con backoff. Solo se ejecuta con Internet.
 */
class UploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val session = Session(applicationContext)
        val token = session.token ?: return@withContext Result.success() // sin sesión: nada que hacer
        val pending = PendingUploads(applicationContext)

        var anyFailed = false
        for (item in pending.all()) {
            val file = File(item.filePath)
            if (!file.exists()) {
                pending.remove(item.id) // el archivo ya no está; no reintentar
                continue
            }
            try {
                val ok = ApiClient.uploadRecording(token, item.orgId, item.interviewId, file)
                if (ok) {
                    pending.remove(item.id)
                    file.delete()
                } else {
                    anyFailed = true
                }
            } catch (_: Exception) {
                anyFailed = true
            }
        }
        if (anyFailed) Result.retry() else Result.success()
    }

    companion object {
        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<UploadWorker>()
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
                )
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork("sas_voz_upload", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
        }
    }
}
