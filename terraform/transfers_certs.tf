resource "aws_acm_certificate" "transfers" {
  domain_name       = "transfers.${local.domain}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "transfers_validation" {
  for_each = {
    for dvo in aws_acm_certificate.transfers.domain_validation_options : dvo.domain_name => {
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

resource "aws_acm_certificate_validation" "transfers" {
  certificate_arn         = aws_acm_certificate.transfers.arn
  validation_record_fqdns = [for record in aws_route53_record.transfers_validation : record.fqdn]
}
