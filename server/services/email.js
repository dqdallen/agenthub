import Brevo from '@getbrevo/brevo'
import nodemailer from 'nodemailer'

const {
  BREVO_API_KEY,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  NODE_ENV,
} = process.env

let brevoApi = null
let smtpTransporter = null

const initBrevo = () => {
  if (!BREVO_API_KEY) {
    return null
  }

  try {
    const defaultClient = Brevo.ApiClient.instance
    const apiKey = defaultClient.authentications['api-key']
    apiKey.apiKey = BREVO_API_KEY
    brevoApi = new Brevo.TransactionalEmailsApi()
    console.log('✅ Brevo 邮件服务已配置')
    return brevoApi
  } catch (error) {
    console.error('❌ Brevo 邮件服务初始化失败:', error.message)
    return null
  }
}

const initSMTP = () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null
  }

  try {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT) || 587,
      secure: parseInt(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
    console.log('✅ SMTP 邮件服务已配置')
    return smtpTransporter
  } catch (error) {
    console.error('❌ SMTP 邮件服务初始化失败:', error.message)
    return null
  }
}

const initEmailService = () => {
  brevoApi = initBrevo()
  if (!brevoApi) {
    smtpTransporter = initSMTP()
  }
  
  if (!brevoApi && !smtpTransporter) {
    console.warn('⚠️  邮件服务未配置，将使用控制台打印模式（开发环境）')
  } else if (brevoApi) {
    console.log('📧 邮件服务: Brevo')
  } else {
    console.log('📧 邮件服务: SMTP')
  }
}

export const sendVerificationCode = async (email, code) => {
  const subject = '【AgentHub】您的验证码'
  const html = `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">AgentHub</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-top: 0;">邮箱验证</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          您好！感谢您注册 AgentHub。您的验证码是：
        </p>
        <div style="background: #f0f4ff; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 10px;">${code}</span>
        </div>
        <p style="color: #999; font-size: 14px;">
          验证码有效期为 10 分钟，请尽快完成验证。
        </p>
        <p style="color: #999; font-size: 14px; margin-top: 20px;">
          如果这不是您本人的操作，请忽略此邮件。
        </p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>此邮件由系统自动发送，请勿回复。</p>
      </div>
    </div>
  `

  const text = `【AgentHub】您的验证码是：${code}，有效期10分钟。`

  return sendEmail(email, subject, html, text)
}

const sendEmail = async (to, subject, html, text) => {
  if (!brevoApi && !smtpTransporter) {
    if (NODE_ENV === 'development') {
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 模拟邮件发送
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
收件人: ${to}
主题: ${subject}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${text}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)
      return { success: true, mock: true }
    }
    throw new Error('邮件服务未配置')
  }

  if (brevoApi) {
    return sendViaBrevo(to, subject, html, text)
  } else {
    return sendViaSMTP(to, subject, html, text)
  }
}

const sendViaBrevo = async (to, subject, html, text) => {
  try {
    const sender = {
      email: SMTP_FROM || 'noreply@agenthub.com',
      name: 'AgentHub',
    }

    const sendSmtpEmail = new Brevo.SendSmtpEmail()
    sendSmtpEmail.sender = sender
    sendSmtpEmail.to = [{ email: to }]
    sendSmtpEmail.subject = subject
    sendSmtpEmail.htmlContent = html
    sendSmtpEmail.text = text

    const result = await brevoApi.sendTransacEmail(sendSmtpEmail)
    console.log(`✅ Brevo 邮件发送成功: ${to}`)
    return { success: true, messageId: result.messageId }
  } catch (error) {
    console.error('❌ Brevo 邮件发送失败:', error.message)
    if (smtpTransporter) {
      console.log('📧 尝试使用 SMTP 发送...')
      return sendViaSMTP(to, subject, html, text)
    }
    throw error
  }
}

const sendViaSMTP = async (to, subject, html, text) => {
  try {
    if (!smtpTransporter) {
      smtpTransporter = initSMTP()
      if (!smtpTransporter) {
        throw new Error('SMTP 服务未配置')
      }
    }

    const info = await smtpTransporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to,
      subject,
      html,
      text,
    })

    console.log(`✅ SMTP 邮件发送成功: ${to}`)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('❌ SMTP 邮件发送失败:', error.message)
    throw error
  }
}

initEmailService()

export default {
  sendVerificationCode,
}
