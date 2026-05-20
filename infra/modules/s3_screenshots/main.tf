resource "aws_s3_bucket" "this" {
  bucket = "${var.name_prefix}-screenshots"
  tags   = var.tags
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "tiered-retention"
    status = "Enabled"

    filter {}

    transition {
      days          = var.transition_days
      storage_class = "GLACIER_IR"
    }

    expiration {
      days = var.expiration_days
    }
  }
}
