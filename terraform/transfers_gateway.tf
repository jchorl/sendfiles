locals {
  transfers_routes = {
    post_transfer = {
      route_key      = "POST /"
      operation_name = "PostTransfer"
    }
    get_transfers = {
      route_key      = "GET /"
      operation_name = "GetTransfer"
    }
  }
}

resource "aws_apigatewayv2_api" "transfers" {
  name                         = "transfers-http-api"
  protocol_type                = "HTTP"
  disable_execute_api_endpoint = true

  # TODO see if we can get rid of this
  cors_configuration {
    allow_methods = ["*"]
    allow_origins = ["*"]
    allow_headers = ["*"]
  }
}

resource "aws_apigatewayv2_deployment" "transfers_deployment" {
  api_id = aws_apigatewayv2_api.transfers.id

  depends_on = [
    aws_apigatewayv2_route.transfers_route,
  ]

  triggers = {
    redeployment = sha1(join(",", list(
      jsonencode(aws_apigatewayv2_integration.transfers_integration),
      jsonencode(aws_apigatewayv2_route.transfers_route),
    )))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_apigatewayv2_stage" "transfers_stage" {
  api_id        = aws_apigatewayv2_api.transfers.id
  name          = "prod"
  description   = "Prod Stage"
  deployment_id = aws_apigatewayv2_deployment.transfers_deployment.id
}

resource "aws_apigatewayv2_integration" "transfers_integration" {
  api_id             = aws_apigatewayv2_api.transfers.id
  integration_type   = "AWS_PROXY"
  description        = "integration"
  integration_uri    = aws_lambda_function.transfers_api.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "transfers_route" {
  for_each       = local.transfers_routes
  api_id         = aws_apigatewayv2_api.transfers.id
  route_key      = each.value.route_key
  operation_name = each.value.operation_name
  target         = "integrations/${aws_apigatewayv2_integration.transfers_integration.id}"
}

resource "aws_apigatewayv2_domain_name" "transfers" {
  domain_name = "transfers.${local.domain}"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate.transfers.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "transfers" {
  api_id      = aws_apigatewayv2_api.transfers.id
  domain_name = aws_apigatewayv2_domain_name.transfers.id
  stage       = aws_apigatewayv2_stage.transfers_stage.id
}
