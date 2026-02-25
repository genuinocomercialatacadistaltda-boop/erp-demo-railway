
import { S3Client } from "@aws-sdk/client-s3";

export function getBucketConfig() {
  return {
    bucketName: process.env.AWS_BUCKET_NAME,
    folderPrefix: process.env.AWS_FOLDER_PREFIX || "",
    region: process.env.AWS_REGION || "us-east-1",
  };
}

export function createS3Client() {
  const { region } = getBucketConfig();
  return new S3Client({ region });
}
