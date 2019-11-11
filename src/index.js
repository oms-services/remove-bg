const express = require('express')
const request = require('request')
const bodyParser = require('body-parser')
const uuidv5 = require('uuid/v5')
const UploadStream = require('s3-stream-upload')
const fs = require('fs')
const path = require('path')

const app = express()
const router = express.Router()
const S3 = require('aws-sdk').S3
const s3 = new S3()
const port = 5000

const SEED = Date.now()
const API_KEY = process.env.REMOVE_BG_API_KEY
const S3_BUCKET = process.env.S3_BUCKET || undefined
const S3_DIRECTORY = process.env.S3_DIRECTORY || undefined

const generateFileName = (name) =>
  `${name}-${uuidv5(`${SEED}`, uuidv5.DNS)}`.substr(0, 23)

const uploadFile = () => {
  const filename = generateFileName('image')
  return new Promise((resolve, reject) => {
    console.log(`Uploading on s3://${S3_BUCKET}/${S3_DIRECTORY}/${filename}.png`)
    fs.createReadStream(path.join(path.resolve(__dirname, '..'), 'image.png'))
      .pipe(
        UploadStream(s3, {
          Bucket: S3_BUCKET,
          Key: `${S3_DIRECTORY}/${filename}.png`,
          ContentType: 'image/png'
        })
      )
    .on('error', err => {
      reject(err)
    })
    .on('finish', () => {
      console.log(`File uploaded at: ${`https://${S3_BUCKET}.s3.amazonaws.com/${S3_DIRECTORY}/${filename}.png`}`)
      const url = `https://${S3_BUCKET}.s3.amazonaws.com/${S3_DIRECTORY}/${filename}.png`
      resolve(url)
    })
  })
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  )
  next()
})
app.use(bodyParser())

router.post('/remove', (req, res) => {
  if (!req.body.url) {
    return console.error('URL not provided')
  }
  console.log(`URL file received: ${req.body.url}`)
  request.post(
    {
      url: 'https://api.remove.bg/v1.0/removebg',
      formData: {
        image_url: req.body.url,
        size: 'auto'
      },
      headers: {
        'X-Api-Key': API_KEY
      },
      encoding: null
    },
    async (error, response, body) => {
      if (error) {
        console.error(`Request failed: ${error}`)
        res.status(500).send(error)
      }
      if (response.statusCode != 200) {
        console.error(`Error: ${response.statusCode}`, body.toString('utf8'))
        res.status(response.statusCode).send({
          statusCode: response.statusCode,
          body: body.toString('utf8')
        })
      }
      console.log('Background removed')
      if (!S3_BUCKET || !S3_DIRECTORY) {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': body.length
        })
        res.end(body)
      } else {
        try {
          fs.writeFileSync('image.png', body, {
            encoding: 'binary'
          })  
          console.log('File written locally')
          uploadFile().then(url => {
            res.end(url)
            return
          }).catch(e => {
            res.status(500).json(e)
            return
          })
        } catch (e) {
          console.log(e)
          res.status(500).json(e)
          return
        }
      }
    }
  )
})

router.get('/health', (req, res) => {
  res.status(200).send(`I'm healthy!`)
})

app.use(router)

console.log(`App listening on port ${port}`)
console.log(`REMOVE_BG_API_KEY: ${API_KEY}`)
console.log(`S3_BUCKET: ${S3_BUCKET}`)
console.log(`S3_DIRECTORY: ${S3_DIRECTORY}`)
console.log(`AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID}`)
console.log(`AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY}`)
console.log(`AWS_REGION: ${process.env.AWS_REGION}`)

app.listen(port)
