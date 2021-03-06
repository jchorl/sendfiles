resource "aws_route53_zone" "sendfiles" {
  name = local.domain
}

resource "aws_route53_record" "root" {
  name    = local.domain
  type    = "A"
  zone_id = aws_route53_zone.sendfiles.zone_id

  alias {
    name                   = aws_cloudfront_distribution.distribution.domain_name
    zone_id                = aws_cloudfront_distribution.distribution.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "transfers" {
  name    = aws_apigatewayv2_domain_name.transfers.domain_name
  type    = "A"
  zone_id = aws_route53_zone.sendfiles.zone_id

  alias {
    name                   = aws_apigatewayv2_domain_name.transfers.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.transfers.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "coord" {
  name    = aws_apigatewayv2_domain_name.coord.domain_name
  type    = "A"
  zone_id = aws_route53_zone.sendfiles.zone_id

  alias {
    name                   = aws_apigatewayv2_domain_name.coord.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.coord.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
