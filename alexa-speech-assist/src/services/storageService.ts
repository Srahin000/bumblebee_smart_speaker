import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

export class StorageService {
  private storage: Storage;
  public bucketName: string;

  constructor() {
    this.storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    this.bucketName = process.env.GCS_BUCKET_NAME || 'ccnyhack-audio';
  }

  /**
   * Upload audio file to Google Cloud Storage
   */
  async uploadAudioFile(audioBuffer: Buffer, fileName?: string): Promise<string> {
    try {
      const fileId = fileName || `audio_${uuidv4()}_${Date.now()}.webm`;
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileId);

      await file.save(audioBuffer, {
        metadata: {
          contentType: 'audio/webm',
          metadata: {
            uploadedAt: new Date().toISOString(),
            source: 'voice-assistant',
          },
        },
      });

      console.log(`Audio file uploaded: gs://${this.bucketName}/${fileId}`);
      return `gs://${this.bucketName}/${fileId}`;
    } catch (error) {
      console.error('Error uploading audio file:', error);
      throw new Error('Failed to upload audio file to Cloud Storage');
    }
  }

  /**
   * Upload text-to-speech audio file to Google Cloud Storage
   */
  async uploadTTSAudioFile(audioBuffer: Buffer, fileName?: string): Promise<string> {
    try {
      const fileId = fileName || `tts_${uuidv4()}_${Date.now()}.mp3`;
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileId);

      await file.save(audioBuffer, {
        metadata: {
          contentType: 'audio/mpeg',
          metadata: {
            uploadedAt: new Date().toISOString(),
            source: 'voice-assistant-tts',
          },
        },
      });

      console.log(`TTS audio file uploaded: gs://${this.bucketName}/${fileId}`);
      return `gs://${this.bucketName}/${fileId}`;
    } catch (error) {
      console.error('Error uploading TTS audio file:', error);
      throw new Error('Failed to upload TTS audio file to Cloud Storage');
    }
  }

  /**
   * Get a signed URL for audio file access
   */
  async getSignedUrl(filePath: string, expirationMinutes: number = 60): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);

      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expirationMinutes * 60 * 1000,
      });

      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error('Failed to generate signed URL');
    }
  }

  /**
   * Delete audio file from Cloud Storage
   */
  async deleteAudioFile(filePath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);
      await file.delete();
      console.log(`Audio file deleted: ${filePath}`);
    } catch (error) {
      console.error('Error deleting audio file:', error);
      throw new Error('Failed to delete audio file');
    }
  }

  /**
   * List audio files in the bucket
   */
  async listAudioFiles(prefix?: string): Promise<string[]> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({
        prefix: prefix || 'audio_',
        delimiter: '/',
      });

      return files.map(file => file.name);
    } catch (error) {
      console.error('Error listing audio files:', error);
      throw new Error('Failed to list audio files');
    }
  }

  /**
   * Create the bucket if it doesn't exist
   */
  async ensureBucketExists(): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        console.log(`Creating bucket: ${this.bucketName}`);
        await bucket.create({
          location: process.env.GCP_LOCATION || 'us-central1',
          storageClass: 'STANDARD',
        });
        console.log(`Bucket created: ${this.bucketName}`);
      } else {
        console.log(`Bucket already exists: ${this.bucketName}`);
      }
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
      throw new Error('Failed to create bucket');
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    bucketName: string;
  }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles();
      
      let totalSize = 0;
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        totalSize += parseInt(metadata.size || '0');
      }

      return {
        totalFiles: files.length,
        totalSize,
        bucketName: this.bucketName,
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw new Error('Failed to get storage statistics');
    }
  }
}
