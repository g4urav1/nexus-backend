import express from "express";
import bcrypt from "bcrypt";

import User from "../models/User.js";

import sender from "../config/mail.js";

const router = express.Router();


router.post("/getCode", async (req, res) => {
  try {
    const { UserName } = req.body;

    const user = await User.findOne({
      Username: UserName,
    });

    if (!user) {
      return res.status(401).json({
        message: "No user found",
      });
    }

    const Code = Math.floor(Math.random() * 900000 + 100000);

    user.Code = Code;

    await user.save();

    const template = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>Nexus Password Reset</title>
</head>

<body
  style="
    margin: 0;
    padding: 0;
    background-color: #f4f6f8;
    font-family: Arial, Helvetica, sans-serif;
    color: #1f2937;
  "
>
  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    border="0"
    style="background-color: #f4f6f8; padding: 40px 16px;"
  >
    <tr>
      <td align="center">

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            max-width: 560px;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
          "
        >

          <!-- Header -->
          <tr>
            <td
              style="
                padding: 32px 40px 20px;
                text-align: center;
              "
            >
              <div
                style="
                  font-size: 28px;
                  font-weight: 700;
                  color: #111827;
                  letter-spacing: -0.5px;
                "
              >
                Nexus
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px 40px;">

              <h1
                style="
                  margin: 0 0 20px;
                  font-size: 24px;
                  line-height: 32px;
                  font-weight: 700;
                  color: #111827;
                "
              >
                Hi ${UserName},
              </h1>

              <p
                style="
                  margin: 0 0 16px;
                  font-size: 16px;
                  line-height: 26px;
                  color: #4b5563;
                "
              >
                We received a request to reset the password
                for your Nexus account.
              </p>

              <p
                style="
                  margin: 0 0 20px;
                  font-size: 16px;
                  line-height: 26px;
                  color: #4b5563;
                "
              >
                Use the verification code below to continue:
              </p>

              <!-- Verification Code -->
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="margin: 24px 0 28px;"
              >
                <tr>
                  <td align="center">
                    <div
                      style="
                        display: inline-block;
                        padding: 16px 28px;
                        background-color: #f3f4f6;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        font-size: 30px;
                        line-height: 36px;
                        font-weight: 700;
                        letter-spacing: 8px;
                        color: #111827;
                      "
                    >
                      ${Code}
                    </div>
                  </td>
                </tr>
              </table>

              <p
                style="
                  margin: 0 0 24px;
                  font-size: 14px;
                  line-height: 22px;
                  color: #6b7280;
                "
              >
                If you didn't request a password reset, you can
                safely ignore this email. Your account and password
                will remain unchanged.
              </p>

              <p
                style="
                  margin: 0;
                  font-size: 14px;
                  line-height: 22px;
                  color: #6b7280;
                "
              >
                <strong style="color: #374151;">
                  Need help?
                </strong>
                Contact the support team.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td
              style="
                padding: 28px 40px;
                background-color: #f9fafb;
                border-top: 1px solid #e5e7eb;
                text-align: center;
              "
            >
              <p
                style="
                  margin: 0 0 8px;
                  font-size: 15px;
                  line-height: 22px;
                  font-weight: 600;
                  color: #374151;
                "
              >
                Connect. Share. Inspire.
              </p>

              <p
                style="
                  margin: 0 0 16px;
                  font-size: 13px;
                  line-height: 20px;
                  color: #9ca3af;
                "
              >
                Your social space for discovering creators
                and connecting with friends.
              </p>

              <p
                style="
                  margin: 0;
                  font-size: 12px;
                  line-height: 18px;
                  color: #9ca3af;
                "
              >
                &copy; 2026 Nexus. All rights reserved.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;

    await sender.sendMail({
      from: `"nexus" <${process.env.MAIL_USER}>`,
      to: user.Email,
      subject: "password reset code",
      html: template,
    });

    return res.status(200).json({
      message: `Check code sent on ${user.Email.replace(
        /^(.{2}).*(.{2})(@.*)$/,
        "$1*****$2$3",
      )}`,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "something went wrong",
    });
  }
});


router.post("/verifyCode", async (req, res) => {
  try {
    const { UserName, Code } = req.body;

    const user = await User.findOne({
      Username: UserName,
    });

    if (!user) {
      return res.status(401).json({
        message: "No user found",
      });
    }

    const verified = user.Code == Code;

    if (!verified) {
      return res.status(402).json({
        message: "invalid Code",
      });
    }

    return res.status(200).json({
      message: "verified",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "something went wrong",
    });
  }
});


router.post("/changePassword", async (req, res) => {
  try {
    const { UserName, Password } = req.body;

    const user = await User.findOne({
      Username: UserName,
    });

    if (!user) {
      return res.status(401).json({
        message: "No user found",
      });
    }

    const hashedPassword = await bcrypt.hash(Password, 10);

    user.Password = hashedPassword;
    user.Code = undefined;

    await user.save();

    return res.status(200).json({
      message: "Password Changed",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "something went wrong",
    });
  }
});

export default router;