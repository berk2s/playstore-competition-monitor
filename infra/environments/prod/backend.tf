terraform {
  backend "s3" {
    bucket         = "berk2s-tf-state"
    key            = "playstore-competition-monitor/prod/terraform.tfstate"
    region         = "eu-west-3"
    dynamodb_table = "berk2s-tf-dynamodb"
    encrypt        = true
  }
}
