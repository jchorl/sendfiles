resource "aws_dynamodb_table" "securesend_table" {
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

data "aws_iam_policy_document" "transfers_lambda" {
  statement {
    sid = "1"

    actions = [
      "sts:AssumeRole",
    ]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "transfers" {
  name = "transfers_lambda_role"

  assume_role_policy = data.aws_iam_policy_document.transfers_lambda.json
}

data "aws_iam_policy_document" "transfers" {
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
    ]

    resources = [
      aws_dynamodb_table.securesend_table.arn
    ]
  }

  statement {
    sid    = "Logging"
    effect = "Allow"

    resources = [
      "arn:aws:logs:*:*:*"
    ]

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
  }
}

resource "aws_iam_policy" "transfers" {
  name   = "transfers_lambda_policy"
  policy = data.aws_iam_policy_document.transfers.json
}

resource "aws_iam_role_policy_attachment" "transfers" {
  role       = aws_iam_role.transfers.name
  policy_arn = aws_iam_policy.transfers.arn
}

resource "aws_lambda_function" "transfers_api" {
  filename      = "build/transfers_lambda.zip"
  function_name = "transfers_api"
  role          = aws_iam_role.transfers.arn
  handler       = "main"

  source_code_hash = filebase64sha256("build/transfers_lambda.zip")

  runtime = "provided"
}

resource "aws_lambda_permission" "apigw" {
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.transfers_api.arn
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.transfers.execution_arn}/*/*"
}
