const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs')
const app = express()
const removeBg = require('remove.bg')
const { OK, BAD_REQUEST } = require('http-status-codes')

const { API_KEY } = process.env

const message = {
  success: 'false'
}

app.use(bodyParser.json())

app.post('/remove-bg', function (req, res) {
  if (req.body.base64content === undefined) {
    message.error = 'Image base64 data not found'
    return res.status(BAD_REQUEST).send(message)
  }

  if (API_KEY === undefined) {
    message.error = 'Please provide API Key'
    return res.status(BAD_REQUEST).send(message)
  }

  const base64img = req.body.base64content
  const outputFile = `${__dirname}/outfile.png`

  removeBg
    .removeBackgroundFromImageBase64({
      base64img,
      apiKey: API_KEY,
      size: 'regular',
      outputFile: outputFile
    })
    .then(function (result) {
      const base64Output = fs.readFileSync(outputFile, { encoding: 'base64' })
      return res.status(OK).json({ base64Output })
    })
    .catch(function (error) {
      message.error = error
      return res.status(BAD_REQUEST).json({ message })
    })
})

app.listen(3000, function () {
  console.log('Working on port 3000')
})
