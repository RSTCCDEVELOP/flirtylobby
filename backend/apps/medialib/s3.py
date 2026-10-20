"""S3 access, configured through the S3 integration (Admin -> API keys)."""
import mimetypes
import os

from apps.integrations.models import Integration


class S3Error(Exception):
    pass


def _integration():
    return Integration.objects.filter(provider="s3").order_by("-enabled", "id").first()


def available():
    """S3 is 'installed' when an S3 integration exists and is switched on."""
    from apps.core import modules

    return modules.enabled("integrations") and Integration.objects.filter(provider="s3", enabled=True).exists()


def config():
    obj = _integration()
    if not obj:
        raise S3Error("S3 is niet gekoppeld (Admin → API keys).")
    return obj.config


def client(cfg=None):
    import boto3
    from botocore.config import Config

    cfg = cfg or config()
    return boto3.client(
        "s3", endpoint_url=(cfg.get("endpoint") or "").strip() or None, region_name=cfg.get("region") or "us-east-1",
        aws_access_key_id=cfg["access_key"], aws_secret_access_key=cfg["secret_key"],
        config=Config(connect_timeout=10, read_timeout=300, retries={"max_attempts": 2}),
    )


def object_key(cfg, key):
    prefix = (cfg.get("prefix") or "").strip("/")
    return f"{prefix}/{key}" if prefix else key


def public_url(key):
    """Public URL of a file on S3 (the bucket or CDN must allow public reads)."""
    try:
        cfg = config()
    except S3Error:
        return ""
    k = object_key(cfg, key)
    if cfg.get("public_url"):
        return f"{cfg['public_url'].rstrip('/')}/{k}"
    if (cfg.get("endpoint") or "").strip():
        return f"{cfg['endpoint'].rstrip('/')}/{cfg['bucket']}/{k}"
    return f"https://{cfg['bucket']}.s3.{cfg.get('region') or 'us-east-1'}.amazonaws.com/{k}"


def upload(item):
    cfg = config()
    c = client(cfg)
    mime = item.mime or mimetypes.guess_type(item.key)[0] or "application/octet-stream"
    c.upload_file(item.local_path, cfg["bucket"], object_key(cfg, item.key),
                  ExtraArgs={"ContentType": mime, "CacheControl": "public, max-age=31536000"})
    head = c.head_object(Bucket=cfg["bucket"], Key=object_key(cfg, item.key))
    if head["ContentLength"] != os.path.getsize(item.local_path):
        raise S3Error("Upload onvolledig: grootte komt niet overeen.")


def download(item):
    cfg = config()
    c = client(cfg)
    os.makedirs(os.path.dirname(item.local_path), exist_ok=True)
    tmp = item.local_path + ".part"
    c.download_file(cfg["bucket"], object_key(cfg, item.key), tmp)
    if os.path.getsize(tmp) != item.size and item.size:
        os.remove(tmp)
        raise S3Error("Download onvolledig: grootte komt niet overeen.")
    os.replace(tmp, item.local_path)


def delete(item):
    cfg = config()
    client(cfg).delete_object(Bucket=cfg["bucket"], Key=object_key(cfg, item.key))
