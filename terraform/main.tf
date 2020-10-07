resource "aws_dynamodb_table" "securesend-table" {
  name           = "SecuresendTransfersTest"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }

  ttl {
    attribute_name = "valid_until"
    enabled        = true
  }
}

resource "aws_s3_bucket" "site" {
  bucket = "securesend-site"
  acl    = "public-read"

  website {
    index_document = "index.html"
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site_public_access.json
}

data "aws_iam_policy_document" "site_public_access" {
  statement {
    actions   = ["s3:Get*", "s3:List*"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }
  }
}
