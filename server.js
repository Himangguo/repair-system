const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 确保uploads目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 静态文件服务
app.use(express.static('public'));

// 修改 multer 配置以支持多文件上传
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'uploads/')
        },
        filename: function (req, file, cb) {
            // 生成唯一文件名
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            cb(null, uniqueSuffix + path.extname(file.originalname))
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024, // 限制 5MB
        files: 5 // 最多 5 个文件
    },
    fileFilter: function (req, file, cb) {
        // 只允许图片
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('只允许上传图片文件'));
        }
        cb(null, true);
    }
}).array('photos', 5); // 使用 array 中间件，字段名为 photos，最多 5 张

// 配置邮件发送
const transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_FROM,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
});

// 添加验证函数
function validateRepairForm(data) {
    const errors = [];
    
    // 学校验证 (2-50个字符)
    if (!data.school || typeof data.school !== 'string' || 
        data.school.length < 1 || data.school.length > 50) {
        errors.push('学校名称必须在1-50个字符之间');
    }
    
    // 楼栋验证 (1-20个字符)
    if (!data.building || typeof data.building !== 'string' || 
        data.building.length < 1 || data.building.length > 20) {
        errors.push('楼栋信息必须在1-20个字符之间');
    }
    
    // 房间号验证 (1-10个字符)
    if (!data.room || typeof data.room !== 'string' || 
        data.room.length < 1 || data.room.length > 10) {
        errors.push('房间号必须在1-10个字符之间');
    }
    
    // 故障描述验证 (10-500个字符)
    if (!data.description || typeof data.description !== 'string' || 
        data.description.length < 1 || data.description.length > 500) {
        errors.push('故障描述必须在1-500个字符之间');
    }
    
    // 手机号验证 (可选，但如果提供必须符合格式)
    if (data.phone && !/^1[3-9]\d{9}$/.test(data.phone)) {
        errors.push('请输入有效的手机号码');
    }
    
    // 预约时间验证
    if (!data.appointmentTime) {
        errors.push('预约时间不能为空');
    } else {
        const appointmentDate = new Date(data.appointmentTime);
        const now = new Date();
        
        if (isNaN(appointmentDate.getTime())) {
            errors.push('请输入有效的预约时间');
        } else if (appointmentDate < now) {
            errors.push('预约时间不能早于当前时间');
        }
    }
    
    return errors;
}

// 添加用于清理输入的辅助函数
function sanitizeInput(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// 修改报修接口
app.post('/api/submit-repair', function(req, res) {
    upload(req, res, async function(err) {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, message: '图片大小不能超过5MB' });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ success: false, message: '最多只能上传5张图片' });
            }
            return res.status(400).json({ success: false, message: err.message });
        }

        try {
            // 验证表单数据
            const validationErrors = validateRepairForm(req.body);
            if (validationErrors.length > 0) {
                // 删除已上传的文件
                if (req.files) {
                    req.files.forEach(file => {
                        fs.unlinkSync(file.path);
                    });
                }
                return res.status(400).json({ 
                    success: false, 
                    message: '表单验证失败',
                    errors: validationErrors 
                });
            }

            // 验证必填字段
            const { school, building, room, description, appointmentTime } = req.body;
            
            if (!school || !building || !room || !description || !appointmentTime) {
                // 删除已上传的文件
                if (req.files) {
                    req.files.forEach(file => {
                        fs.unlinkSync(file.path);
                    });
                }
                return res.status(400).json({ success: false, message: '请填写所有必填字段' });
            }

            // 构建邮件内容
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: process.env.EMAIL_TO,
                subject: '新的报修申请',
                html: `
                    <h2>报修信息</h2>
                    <p><strong>学校：</strong>${sanitizeInput(school)}</p>
                    <p><strong>楼栋：</strong>${sanitizeInput(building)}</p>
                    <p><strong>房间号：</strong>${sanitizeInput(room)}</p>
                    <p><strong>故障描述：</strong>${sanitizeInput(description)}</p>
                    <p><strong>联系电话：</strong>${sanitizeInput(req.body.phone || '未提供')}</p>
                    <p><strong>预约时间：</strong>${new Date(appointmentTime).toLocaleString()}</p>
                `,
                attachments: req.files ? req.files.map((file, index) => ({
                    filename: '故障图片' + (index + 1) + path.extname(file.originalname),
                    path: file.path
                })) : []
            };

            // 发送邮件
            await transporter.sendMail(mailOptions);

            res.json({ success: true, message: '报修信息提交成功' });
        } catch (error) {
            console.error('处理报修请求失败:', error);
            // 删除已上传的文件
            if (req.files) {
                req.files.forEach(file => {
                    fs.unlinkSync(file.path);
                });
            }
            res.status(500).json({ success: false, message: '服务器错误，请稍后重试' });
        }
    });
});

// 定期清理超过一定时间的图片
const cleanupUploads = () => {
  const uploadsDir = path.join(__dirname, 'uploads');
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return console.error(err);
    
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return console.error(err);
        
        // 删除超过1天的文件
        if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
          fs.unlink(filePath, err => {
            if (err) console.error(err);
            console.log(`已删除过期文件: ${file}`);
          });
        }
      });
    });
  });
};

// 每天执行一次清理
setInterval(cleanupUploads, 24 * 60 * 60 * 1000);

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
}); 