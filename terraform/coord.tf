resource "aws_dynamodb_table" "offers_table" {
  name           = "Offers"
  billing_mode   = "PROVISIONED"
  read_capacity  = 12
  write_capacity = 12
  hash_key       = "transfer_id"

  attribute {
    name = "transfer_id"
    type = "S"
  }

  ttl {
    attribute_name = "valid_until"
    enabled        = true
  }
}

data "aws_iam_policy_document" "coord_lambda" {
  statement {
    actions = [
      "sts:AssumeRole",
    ]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "coord" {
  name = "coord_lambda_role"

  assume_role_policy = data.aws_iam_policy_document.coord_lambda.json
}

data "aws_iam_policy_document" "coord" {
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
    ]

    resources = [
      aws_dynamodb_table.offers_table.arn
    ]
  }

  statement {
    actions = [
      "execute-api:ManageConnections",
    ]

    resources = [
      "${aws_apigatewayv2_api.coord.execution_arn}/*/POST/@connections/{connectionId}"
    ]
  }
}

resource "aws_iam_policy" "coord" {
  name   = "coord_lambda_policy"
  policy = data.aws_iam_policy_document.coord.json
}

resource "aws_iam_role_policy_attachment" "coord" {
  role       = aws_iam_role.coord.name
  policy_arn = aws_iam_policy.coord.arn
}

resource "aws_iam_role_policy_attachment" "coord_lambda" {
  role       = aws_iam_role.coord.name
  policy_arn = data.aws_iam_policy.AWSLambdaBasicExecutionRole.arn
}

resource "aws_lambda_function" "coord_api" {
  function_name = "coord_api"
  role          = aws_iam_role.coord.arn
  architectures = ["arm64"]

  filename = data.archive_file.dummy.output_path

  environment {
    variables = {
      RUST_LOG = "warn"

      # this works because coord.sendfiles.dev is aliased to "domain/stage"
      # ordinairily, you'd need
      # domain_name/stage (stage = prod)
      SENDFILES_API_GATEWAY_URL = "https://coord.${local.domain}"
    }
  }

  handler = "bootstrap"
  runtime = "provided.al2023"
  timeout = 1
}

resource "aws_lambda_permission" "coord_apigw" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.coord_api.arn
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.coord.execution_arn}/*/*"
}
