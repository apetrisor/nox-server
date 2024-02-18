import {S3Client, PutObjectCommand, ListObjectsCommand, DeleteObjectsCommand, HeadBucketCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';

class S3 {
	init(config) {
		if (this.client) this.client.destroy();
		this.client = new S3Client({
			region: config.region,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.accessKey,
			},
		});
		this.bucket = config.bucket;
	}

	async upload(data, path) {
		try {
			const command = new PutObjectCommand({
				Bucket: this.bucket,
				Key: path,
				Body: data,
				ACL: 'public-read',
			});
			return this.client.send(command);
		} catch (err) {
			console.error(err);
		}
	}

	async listFiles(path) {
		try {
			const command = new ListObjectsCommand({
				Bucket: this.bucket,
				Prefix: path,
			});
			let {Contents} = await this.client.send(command);
			return Contents;
		} catch (err) {
			console.error(err);
		}
	}

	// Takes in an array of paths
	async delete(objects) {
		if (!objects.length) return;
		try {
			const command = new DeleteObjectsCommand({
				Bucket: this.bucket,
				Delete: {
					Objects: objects.map(item => ({Key: item})),
				},
			});
			return this.client.send(command);
		} catch (err) {
			console.error(err);
		}
	}

	async test() {
		try {
			const command = new HeadBucketCommand({
				Bucket: this.bucket,
			});
			return this.client.send(command);
		} catch (err) {
			console.error(err);
		}
	}

	async getSignedUploadUrl({bucket, key, contentType, expires, acl}) {
		try {
			const command = new PutObjectCommand({
				Bucket: bucket || this.bucket,
				Key: key,
				ContentType: contentType,
				ACL: acl,
			});

			return getSignedUrl(this.client, command, {expiresIn: expires});
		} catch (err) {
			console.error(err);
		}
	}
}

export default S3;
