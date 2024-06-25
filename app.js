var express = require('express')
var cors = require('cors')
var app = express()
var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()
var jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const saltRounds = 10
const secret = 'Fullstack-Login';
const multer = require('multer');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const destinationPath = './uploads'; // ปรับเปลี่ยนเส้นทางปลายทาง

    // สร้างไดเร็คทอรีหากยังไม่มี
    fs.mkdirSync(destinationPath, { recursive: true });

    cb(null, destinationPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});


const upload = multer({ storage })

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use('/uploads', express.static('uploads'));


const mysql = require('mysql2');

var db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '12345678',
  database: 'finalproject'
});

function handleDisconnect() {
  db.connect(function(err) {
    if (err) {
      console.error('Error connecting to MySQL: ' + err.stack);
      setTimeout(handleDisconnect, 60000); // ลองเชื่อมต่อใหม่ทุก 2 วินาที
      return;
    }
    console.log('Connected to MySQL as id ' + db.threadId);
  });

  db.on('error', function(err) {
    console.error('MySQL connection error: ' + err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Connection lost, attempting to reconnect...');
      handleDisconnect(); // ลองเชื่อมต่อใหม่เมื่อเกิดข้อผิดพลาด
    } else {
      throw err;
    }
  });
}

handleDisconnect(); // เรียกใช้ฟังก์ชันเพื่อเริ่มต้นการเชื่อมต่อ

  app.post('/upload', upload.single('file'), (req, res) => {
    res.json(req.file);
  });

  app.post('/savefilename', (req, res) => {
    // Save the filename to the database (you can use your database logic here)
    const filename = req.body.filename;
    db.execute(
      'INSERT INTO item (item_image) VALUES (?)',
      [filename],
      function(err){
          if(err){
              res.json({status: 'error', message: err})
              return
          }
          res.json({status: 'ok'})
      }
    );
  });

  app.get('/getImage/:id_item', (req, res) => {
    const id_item = req.params.id_item;
  
    // Query ข้อมูล item_image จากฐานข้อมูล โดยให้ id_item ตรงกับที่รับมา
    db.execute(
      'SELECT item_image FROM item WHERE id_item = ?',
      [id_item],
      (err, result) => {
        if (err) {
          console.error('Error querying database:', err);
          res.status(500).json({ error: 'Internal server error' });
          return;
        }
  
        // ถ้าไม่มีข้อมูลหรือไม่มีรูปภาพก็ส่งค่าว่างกลับ
        if (result.length === 0 || !result[0].item_image) {
          res.json({ fileName: '' });
          return;
        }
  
        // ตรวจสอบว่าไฟล์รูปภาพมีอยู่หรือไม่
        const imagePath = `uploads/${result[0].item_image}`;
        if (!fs.existsSync(imagePath)) {
          res.json({ fileName: '' });
          return;
        }
  
        // ส่งชื่อไฟล์รูปภาพกลับไปยัง client
        res.json({ fileName: result[0].item_image });
      }
    );
  });

app.get('/getQRCode', (req, res) => {
  // ส่งชื่อไฟล์ qrcode.jpg กลับไปยัง client
  res.json({ fileName: 'qrcode.png' });
});

app.get('/getQRCode2', (req, res) => {
  // ส่งชื่อไฟล์ qrcode.jpg กลับไปยัง client
  res.json({ fileName: 'qrcode2.png' });
});

app.post('/register', jsonParser , function (req, res, next) {
    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        db.execute(
            'INSERT INTO users (email, password, fname, lname, address, telephone, user_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.body.email, hash, req.body.fname, req.body.lname, req.body.address ,req.body.telephone ,req.body.usertype],
            function(err){
                if(err){
                    res.json({status: 'error', message: err})
                    return
                }
                res.json({status: 'ok'})
            }
        );
    });
})

app.post('/login', jsonParser , function (req, res, next) {
    db.execute(
        'SELECT * FROM users WHERE email=?',
        [req.body.email],
        function(err, users){
            if(err){ res.json({status: 'error', message: err}); return }
            if(users.length == 0){ res.json({status: 'error', message: 'no users found'}); return }
            bcrypt.compare(req.body.password, users[0].password, function(err, isLogin){
                if(isLogin){
                    var token = jwt.sign({ email: users[0].email }, secret, {expiresIn: '1h'});
                    var user = users[0].id_user;
                    var usertype = users[0].user_type
                    res.json({status: 'ok' , message: 'login success', token , user , usertype})

                }
                else{
                    res.json({status: 'error' , message: 'login failed'})
                }
            });
        }
    );
})

app.post('/authen', jsonParser , function (req, res, next) {
    try{
        const token = req.headers.authorization.split(' ')[1]
        var decoded = jwt.verify(token, secret);
        res.json({status: 'ok', decoded})
    }
    catch(err){
        res.json({status: 'error' , message: err.message})
    }
    
})

app.get('/getitems', function (req, res, next) {
    db.execute(
        'SELECT * FROM `item`',
        function(err, item){
            if(err){
                console.log('error')
            }else{
                res.send(item)
            }
        }
    );
})

app.post('/order', jsonParser, async (req, res) => {
    try {
      const { id_item, id_user, order_count, item_price, status } = req.body;
  
      await db.execute(
        'INSERT INTO `order`(`id_item`, `id_user`, `order_count`, `item_price`, `status`) VALUES (?, ?, ?, ?, ?)',
        [id_item, id_user, order_count, item_price, status]
      );
  
      res.json({ status: 'success', message: 'Order placed successfully' });
    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  });
  

app.get('/cart', function (req, res, next) {
  const {id_user} = req.query
    try{
        db.execute(
          'SELECT item.id_item, order.id_user, item.item_name, item.item_price, item.item_amount, order.order_count, item.item_image, order.status FROM `order` INNER JOIN `item` \
          ON order.id_item = item.id_item WHERE order.id_user = ? AND order.status = "order"',
        [id_user],
          function(err, item){
            if(err){
                return res.json({ status: 'error', message: 'ไม่สามารถดึงข้อมูลตะกร้าได้' });
            }else{
                res.send(item)
            }
        }
        );
    }
    catch (error) {
        console.error('Error:', error.message);
        return res.status(400).json({
          status: 'error',
          message: error.message // Provide informative error message
        });
      }
})

app.delete("/deleteitem/:id_item/:id_user", (req, res) => {
    try {
      const id_item = req.params.id_item;
      const id_user = req.params.id_user;
  
      db.query(
        "DELETE FROM `order` WHERE `id_item` = ? AND `id_user` = ?",
        [id_item, id_user],
        function (err, item) {
          if (err) {
            console.log(err);
            return res.status(500).json({
              status: 'error',
              message: 'Internal server error',
            });
          } else {
            return res.status(200).json({
              status: 'success',
              message: 'Item deleted successfully',
            });
          }
        }
      );
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(400).json({
        status: 'error',
        message: error.message, // Provide informative error message
      });
    }
  });

  app.put("/updateitem/:id", (req, res) => {
    try {
      const id_item = req.body.id_item;
      const id_user = parseInt(req.body.id_user);
      const order_count = parseInt(req.body.order_count);
      console.log(req.body,'body')
      db.query(
        "UPDATE `order` SET order_count = ? WHERE id_item = ? AND id_user = ?", 
        [order_count, id_item, id_user],
        (err, item) => {
          if (err) {
            console.error(err);
            return res.status(500).json({
              status: 'error',
              message: 'Internal server error',
            });
          }
          // Respond with success
          res.status(200).json({
            status: 'success',
            message: 'Item updated successfully',
            result: item, // You may modify this based on your needs
          });
        }
      );
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(400).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  app.put('/checkoutitemorder/:id', function (req, res, next) {
      try{
        const id_user = req.body.id_user
          db.execute(
            'UPDATE `order` SET status = "waiting" WHERE id_user = ?',
            [id_user],
            function(err, result){
              if(err){
                  return res.json({ status: 'error', message: 'ซื้อสินค้าเรียบร้อย' });
              }else{
                  res.send(result)
              }
          });
      }
      catch (error) {
          console.error('Error:', error.message);
          return res.status(400).json({
            status: 'error',
            message: error.message // Provide informative error message
          });
        }
  });

  app.put('/checkoutitem', function (req, res, next) {
    try {
      const order_count = parseInt(req.body.item_amount);
      const id_item = parseInt(req.body.id_item);
      console.log(req.body);
      db.execute(
        'UPDATE `item` SET item_amount = item_amount - ? WHERE id_item = ?',
        [order_count, id_item],
        function (err, result) {
          if (err) {
            console.log(result, 'item');
            return res.json({
              status: 'error',
              message: 'ซื้อสินค้าไม่สำเร็จ',
            });
          } else {
            res.send(result);
          }
        }
      );
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  });
  
  app.post('/addproducts', jsonParser , function (req, res, next) {
    try {
      db.execute(
        'INSERT INTO item (item_name, item_price, item_amount, item_image) VALUES (?, ?, ?, ?)',
        [req.body.item_name , req.body.item_price , req.body.item_amount , req.body.item_image],
        function(err){
          if(err){
            res.json({status: 'error', message: err})
            return
          }
          res.json({status: 'ok'})
        }
      );
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }
  });

  app.delete("/admindeleteitem/:id_item", (req, res) => {
    try {
      const id_item = req.params.id_item;
  
      db.query(
        "DELETE FROM `item` WHERE `id_item` = ?",
        [id_item],
        function (err, item) {
          if (err) {
            console.log(err);
            return res.status(500).json({
              status: 'error',
              message: 'Internal server error',
            });
          } else {
            return res.status(200).json({
              status: 'success',
              message: 'Item deleted successfully',
            });
          }
        }
      );
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(400).json({
        status: 'error',
        message: error.message, // Provide informative error message
      });
    }
  });

  app.put("/adminupdateitem/:id", (req, res) => {
    try {
      const item_amount = parseInt(req.body.item_amount);
      const id_item = req.body.id_item;
      db.query(
        "UPDATE `item` SET item_amount = ? WHERE id_item = ?", 
        [item_amount, id_item],
        (err, item) => {
          if (err) {
            return res.json({ status: 'error', message: 'เพิ่มสินค้าไม่สำเร็จ' });
          }else{
            res.send(item)
          }
        }
      );
    } catch (error) {
      console.error('Error:', error.message);
      return res.status(400).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  });

  app.get('/getprofiles/:id_user', function (req, res, next) {
    const id_user = req.params.id_user;
    db.execute(
        'SELECT * FROM `users` WHERE id_user=?',
        [id_user],
        function(err, item){
            if(err){
                console.log('error')
            }else{
                res.send(item)
            }
        }
    );
})  

app.put('/updateprofile', jsonParser, function (req, res, next) {
    bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
        db.execute(
            'UPDATE `users` SET password=?, fname=?, lname=?, address=?, telephone=? WHERE id_user=?',
            [hash, req.body.fname, req.body.lname, req.body.address, req.body.telephone, req.body.id_user],
            function (err) {
                if (err) {
                    res.json({ status: 'error', message: err })
                    return
                }
                res.json({ status: 'ok' })
            }
        );
    });
});

app.post('/addcheckout', jsonParser , function (req, res, next) {
  try {
    db.execute(
      'INSERT INTO checkout (id_user, total_price, status, id_item, order_id, order_count) VALUES (?, ?, ?, ?, ?, ?)',
      [req.body.id_user , req.body.total_price , req.body.status , req.body.id_item , req.body.order_id , req.body.order_count ],
      function(err){
        if(err){
          res.json({status: 'error', message: err})
          return
        }
        res.json({status: 'ok'})
      }
    );
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
});

app.get('/getwaitingcheckout', function (req, res, next) {
  db.execute(
      'SELECT * FROM `checkout` WHERE id_user = ? AND status = "waiting"',
      [req.query.id_user],
      function(err, item){
          if(err){
              console.log(err)
          }else{
              res.send(item)
          }
      }
  );
})

app.get('/getshippingcheckout', function (req, res, next) {
  db.execute(
      'SELECT * FROM `checkout` WHERE id_user = ? AND status = "shipping"',
      [req.query.id_user],
      function(err, item){
          if(err){
              console.log(err)
          }else{
              res.send(item)
          }
      }
  );
})

app.get('/getorder', function (req, res, next) {
  db.execute(
      'SELECT * FROM `checkout` INNER JOIN `users` ON checkout.id_user = users.id_user WHERE checkout.status = "shipping"',
      function(err, item){
          if(err){
              console.log(err)
          }else{
              res.send(item)
          }
      }
  );
})

app.put('/updatestatusproduct', jsonParser, function (req, res, next) {
  db.execute(
    'UPDATE `checkout` SET status="success" WHERE id_item=? AND order_id=?',
    [req.body.id_item , req.body.order_id],
    function (err, result) {
      if (err) {
        console.error('Error updating status:', err);
        res.json({ status: 'error', message: err });
        return;
      }
      console.log('Status updated successfully:', result);
      res.json({ status: 'ok' });
    }
  );
});

app.get('/checkingorder', function (req, res, next) {
  db.execute(
    'SELECT * FROM `checkout` INNER JOIN `ocrtranscript` INNER JOIN `users` ON checkout.order_id = ocrtranscript.order_id AND checkout.id_user = users.id_user',
    function(err, items){
        if(err){
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        res.json(items);
    }
  );
});

app.put('/updateorder', jsonParser, function (req, res, next) {
  db.execute(
    'UPDATE `checkout` INNER JOIN `ocrtranscript` SET `checkout`.`total_price` = ?, `ocrtranscript`.`total_amount` = ?  WHERE `checkout`.`order_id` = ? AND `ocrtranscript`.`order_id` = ?',
    [req.body.total_price , req.body.total_amount , req.body.order_id , req.body.order_id], // ใช้ req.body.order_id สำหรับการอ้างอิง order_id
    function (err, result) {
      if (err) {
        console.error('Error updating status:', err);
        res.json({ status: 'error', message: err });
        return;
      }
      console.log('Status updated successfully:', result);
      res.json({ status: 'ok' });
    }
  );
});

app.listen(4452, jsonParser , function () {
  console.log('CORS-enabled web server listening on port 4452')
})
