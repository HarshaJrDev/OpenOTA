package com.openota.runtime

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.nio.file.Files

@RunWith(AndroidJUnit4::class)
class BundleStorageInstrumentedTest {
    private lateinit var storage: BundleStorage

    @Before
    fun setUp() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        storage = BundleStorage(context)
        storage.deleteRecursively(storage.rootDir)
        listOf(storage.currentDir, storage.rollbackDir, storage.downloadsDir, storage.cacheDir, storage.tmpDir, storage.logsDir)
            .forEach { it.mkdirs() }
    }

    @Test
    fun createsAllRequiredSubdirectoriesUnderRoot() {
        for (dir in listOf(storage.currentDir, storage.rollbackDir, storage.downloadsDir, storage.cacheDir, storage.tmpDir, storage.logsDir)) {
            assertTrue(dir.exists())
            assertTrue(dir.path.startsWith(storage.rootDir.path))
        }
    }

    @Test
    fun rejectsPathTraversalOutsideRoot() {
        assertThrows(PathSecurityException::class.java) {
            storage.resolveWithinRoot("../../etc/passwd")
        }
    }

    @Test
    fun rejectsAbsolutePathsOutsideTheSandbox() {
        assertThrows(PathSecurityException::class.java) {
            storage.resolveWithinRoot("/etc/passwd")
        }
    }

    @Test
    fun acceptsAbsolutePathsInsideTheSandbox() {
        val inside = File(storage.downloadsDir, "candidate")
        inside.mkdirs()

        val resolved = storage.resolveWithinRoot(inside.path)
        assertEquals(inside.canonicalPath, resolved.path)
    }

    @Test
    fun rejectsSymlinksInsideACandidateDirectory() {
        val packageDir = File(storage.tmpDir, "pkg-with-symlink")
        packageDir.mkdirs()
        val realFile = File(storage.tmpDir, "real.txt").apply { writeText("data") }
        val link = File(packageDir, "link.txt")
        Files.createSymbolicLink(link.toPath(), realFile.toPath())

        assertThrows(PathSecurityException::class.java) {
            storage.assertNoSymlinks(packageDir)
        }
    }

    @Test
    fun atomicReplaceMovesSourceContentsIntoDestination() {
        val source = File(storage.tmpDir, "source").apply { mkdirs() }
        File(source, "marker.txt").writeText("hello")
        val destination = File(storage.tmpDir, "destination").apply { mkdirs() }
        File(destination, "stale.txt").writeText("old")

        storage.atomicReplace(source, destination)

        assertTrue(File(destination, "marker.txt").exists())
        assertTrue(!File(destination, "stale.txt").exists())
        assertTrue(!source.exists())
    }
}
