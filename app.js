if (process.env.NODE_ENV !== "production") {
  require("dotenv").config(); 
}

const { default: axios } = require('axios')
const express = require('express')
const app = express()
const { User, SavedPassword, Order } = require('./models')
const { Op } = require("sequelize")
const { comparePassword, hashPassword } = require('./helpers/bcrypt')
const { signToken } = require('./helpers/jwt')
const authentication = require('./middlewares/authentication')
const limit = require("express-limit").limit
const nodemailer = require("nodemailer");
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client();
const midtransClient = require('midtrans-client')
const cron = require('node-cron')
const cors = require('cors')
const { rateLimit } = require('express-rate-limit');
const vertexAi = require("./helpers/vertex-ai");


const limitNonPremium = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 minutes
  limit: 2, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  // store: ... , // Redis, Memcached, etc. See below.
})

const limitPremium = rateLimit({
  windowMs: 1 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  // store: ... , // Redis, Memcached, etc. See below.
})

const limiter = (req,res,next) =>{
  const {status} = req.user
  if (status === 'non-premium'){
    return limitNonPremium(req, res, next)
  }
  return limitPremium(req,res,next) 

}




const middlewaresLimit = limit({
  max: 2, // 5 requests
  period: 60 * 1000, // per minute (60 seconds)
})


app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(cors())


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.post('/register', async (req, res) => {
  try {
    req.body.password = hashPassword(req.body.password);
    const result = await User.create(req.body)
    console.log('masuk');
    res
      .status(200)
      .json({
        email: result.email
      });
  } catch (error) {

    res.status(500).json({
      message
    })
    
    console.log(error);
  }
})


app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      throw {
        name: 'BadRequest',
        message: 'email and password is required',
        status: 400
      }
    }
    const user = await User.findOne({
      where: {
        email
      }
    })
    if (!user) {
      throw {
        name: 'Unauthorized',
        message: 'Email wrong',
        status: 401
      }
    }
    const isValidPassword = comparePassword(password, user.password)
    if (!isValidPassword) {
      throw {
        name: 'Unauthorized',
        message: 'Password wrong',
        status: 401
      }
    }
    const access_token = signToken({ id: user.id })

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "jafarbdurr@gmail.com",
        pass: "zvvx nvfq xmqg jokd",
      },
    });

    // async..await is not allowed in global scope, must use a wrapper
    async function main() {
      // send mail with defined transport object
      const info = await transporter.sendMail({
        from: 'Password Manager', // sender address
        to: req.body.email, // list of receivers
        subject: "Login Verification Link", // Subject line
        text: "", // plain text body
        html: `<a href="${req.headers.origin}/verify?t=${access_token}">Login Verification</a>`
      });

    }
    main().catch(console.error);
    res
      .status(200)
      .json({ message: `Email sent to user : "${req.headers.origin}/verify"` })
  } catch (error) {
    console.log(error);
  }
})


app.get('/verify', async (req, res) => {
  const { t } = req.query
  try {
    const access_token = t
    res
      .status(200)
      .json({ access_token })
  } catch (error) {
    console.log(error);
  }
})
app.post('/google-login', async (req, res) => {
  try {
    const { google_token } = req.body

    const ticket = await client.verifyIdToken({
      idToken: google_token,
      audience: process.env.GOOGLE_CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
      // Or, if multiple clients access the backend:
      //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
    });
    const payload = ticket.getPayload();
    const [user, created] = await User.findOrCreate({
      where: {
        email: payload.email,
      },
      defaults: {
        email: payload.email,
        password: hashPassword('admin'),
      }
    })
    const access_token = signToken({ id: user.id })

    // If request specified a G Suite domain:
    // const domain = payload['hd'];

    res
      .status(created ? 201 : 200)
      .json({
        "message": `User ${user.email} found`,
        "access_token": access_token,
        "status" : `${user.status}`
      })
  } catch (error) {
    console.log(error);
  }
})

const limitApi = function (req, res, next) {

  if (req.user.status == "premium") {
    return next()
  }
  middlewaresLimit(req, res, next)
}


app.use(authentication)

app.get('/get-user-data', async (req, res, next) => {
  try {
    res.status(200).json(req.user)
  } catch (error) {
    next(error)
  }
})

app.get('/generatePassword/:length',limiter, async (req, res) => {
  try {
    //rqr length from params
    const { length } = req.params
    const result = await axios.get('https://api.api-ninjas.com/v1/passwordgenerator?length=' + length, {
      headers: {
        'X-Api-Key': "HYrG1yi3VRNawDJMapPiYw==Y83Ls0yTYG8ZGUYo",
        'Content-Type': 'application/json'
      }
    })
    res
      .status(200)
      .json({
        result: result.data.random_password
      });
  } catch (error) {
    console.log(error);
  }
})

app.post('/savePassword', async (req, res) => {
  try {
    //rqr name, password, user id, req,body
    req.body.userId = req.user.id

    const result = await SavedPassword.create(req.body)

    res
      .status(200)
      .json(result);
  } catch (error) {
    console.log(error);
  }
})
app.get('/savePassword', async (req, res) => {
  try {
    //rqr name, password, user id, req,body
    const userId = req.user.id

    const result = await SavedPassword.findAll({
      where: {
        userId: userId
      }
    })
    // console.log(result);

    res
      .status(200)
      .json(result);
  } catch (error) {
    console.log(error);
  }
})
app.get('/savePassword/:id', async (req, res) => {
  try {
    //rqr name, password, user id, req,body
    const userId = req.user.id

    const result = await SavedPassword.findByPk(req.params.id)
    // console.log(result);

    res
      .status(200)
      .json(result);
  } catch (error) {
    console.log(error);
  }
})
app.delete('/savePassword/:id', async (req, res) => {
  try {
    //rqr name, password, user id, req,body
    const result = await SavedPassword.destroy({
      where : {
        id : req.params.id
      }
    })

    res
      .status(200)
      .json(result);
  } catch (error) {
    console.log(error);
  }
})
app.patch('/savePassword', async (req, res) => {
  try {
    const { id } = req.params
    const data = SavedPassword.findByPk(id)
    //rqr name, password, user id, req,body
    let { password } = req.body
    
     if (password) {
      const result = await data.update({
        password
      }, {
        where: id
      })
    } else {
      throw {message : "cant update"}
    }

    res
      .status(200)
      .json({
        message: "Success update"
      });
  } catch (error) {
    console.log(error);
  }
})

app.get('/users/me',async(req,res,next)=>{
  try {
    const user = await User.findByPk(req.user.id, {
        attributes : ['id', 'email','status', 'role']
    })
    res.json(user)
} catch (error) {
    console.log(error)
}
})

app.patch('/users/me/upgrade', async (req, res) => {
  const userId = req.user.id
  const orderId = req.body.orderId
  try {
    const user = await User.findByPk(userId)
    if (!user) {
      throw { name: "Unauthorized", message: "You are not authorized to upgrade" }
    }
    if (user.status == 'premium') {
      return res.json({ success: false, message: "Already premium" })
    }
     const order = await Order.findOne({
      where: {
        orderId
      }
    })

    if (!order) {
      throw { name: 'Not Found', message: "No Transaction Found" }
    }

    const url = `https://api.sandbox.midtrans.com/v2/${orderId}/status`
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: "Basic " +  btoa(`SB-Mid-server-Usvy4Y_GLgaUDsdcduGVCGty:`)
      }
    }

    const { data } = await axios.get(url, options)

    if (data.transaction_status === 'capture' && +data.status_code === 200) {
      await order.update({
        status: 'paid',
        paidDate: new Date()
      })

      await user.update({
        status: 'premium'
      })

      res.json({ message: 'Upgrade account success' })
    } else {
      res.status(400).json({ message: 'Transaction is not success' })
    }
  } catch (error) {
    if (error.name === 'Unauthorized') {
      res.status(401).json({ message: error.message })
    } else if (error.name === 'NotFound') {
      res.status(404).json({ message: error.message })
    } else {
      res.status(500).json({ message: `Internal server error` })
    }
  }
})

app.get('/payment/midtrans/initiate',async (req, res, next) => {
  try {
    let snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: `SB-Mid-server-Usvy4Y_GLgaUDsdcduGVCGty`
    })

    const orderId = `TRX-au-${Math.random().toString()}`
    const trxAmount = 5000
    const transaction = await snap.createTransaction({
      "transaction_details": {
        "order_id": orderId,
        "gross_amount": trxAmount
      },
      "credit_card": {
        "secure": true
      },
      "customer_details": {
        "email": req.user.email
      }
    })

    await Order.create({
      orderId,
      userId: req.user.id,
      amount: trxAmount
    })
    res.json({ token: transaction.token, orderId })
  } catch (error) {
    console.log(error)
  }

})

app.post('/aigenerate', vertexAi)

module.exports = app
