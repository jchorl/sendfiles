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
