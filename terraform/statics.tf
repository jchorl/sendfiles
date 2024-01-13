resource "aws_s3_bucket" "site" {
  bucket = "securesend-site"
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.cloudfront_access.json
}

data "aws_iam_policy_document" "cloudfront_access" {
  statement {
    actions   = ["s3:Get*", "s3:List*"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "AWS"
      identifiers = [aws_cloudfront_origin_access_identity.cloudfront_access.iam_arn]
    }
  }
}

# cloudfront can only use certs in us-east-1
# https://docs.aws.amazon.com/acm/latest/userguide/acm-services.html
# "To use an ACM certificate with CloudFront, you must request or import the certificate in the US East (N. Virginia) region."
resource "aws_acm_certificate" "root" {
  provider          = aws.us-east-1
  domain_name       = local.domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "root_validation" {
  for_each = {
    for dvo in aws_acm_certificate.root.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.sendfiles.zone_id
}

resource "aws_acm_certificate_validation" "root" {
  provider                = aws.us-east-1 # because cloudfront/acm require cert in east-1
  certificate_arn         = aws_acm_certificate.root.arn
  validation_record_fqdns = [for record in aws_route53_record.root_validation : record.fqdn]
}

resource "aws_cloudfront_origin_access_identity" "cloudfront_access" {}

resource "aws_cloudfront_distribution" "distribution" {
  aliases = [local.domain]

  origin {
    domain_name = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id   = local.domain

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.cloudfront_access.cloudfront_access_identity_path
    }
  }

  enabled             = true
  default_root_object = "index.html"

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  default_cache_behavior {
    viewer_protocol_policy = "redirect-to-https"

    compress         = true
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.domain

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.root.arn
    ssl_support_method  = "sni-only"
  }
}
