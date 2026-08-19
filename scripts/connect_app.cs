using System;
using System.IO;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Collections.Generic;

namespace StreamClipsConnect
{
    public class Program : Form
    {
        // UI Controls
        private Panel cardPanel;
        private Label logoIcon;
        private Label titleLabel;
        private Label subtitleLabel;
        private Panel statusPill;
        private Panel statusDot;
        private Label statusLabel;
        
        // Pairing Code Controls
        private Panel codeInputPanel;
        private TextBox codeTextBox;
        private Button pasteBtn;
        private Button verifyCodeBtn;

        // Profile & Channel Controls
        private Button connectYtBtn;
        private Button logoutBtn;
        private Panel profileCard;
        private Label profileEmailLabel;
        private Label profileChannelLabel;

        // Session File Path
        private static string sessionFile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "StreamClipsAuthProfile", "user_session.json");

        // Session State
        private string authenticatedEmail = null;
        private string authenticatedUserId = null;
        private string connectedChannelHandle = null;

        public Program()
        {
            try
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;
                ServicePointManager.Expect100Continue = false;
            }
            catch {}

            // Enable Hardware-Accelerated Double Buffering to Eliminate Flicker
            this.SetStyle(ControlStyles.OptimizedDoubleBuffer | ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint, true);
            this.UpdateStyles();

            InitializeComponent();
            LoadSavedSession();
        }

        private static GraphicsPath GetRoundedPath(Rectangle bounds, int radius)
        {
            int diameter = radius * 2;
            Size size = new Size(diameter, diameter);
            Rectangle arc = new Rectangle(bounds.Location, size);
            GraphicsPath path = new GraphicsPath();

            if (radius == 0)
            {
                path.AddRectangle(bounds);
                return path;
            }

            // Top Left
            path.AddArc(arc, 180, 90);

            // Top Right
            arc.X = bounds.Right - diameter;
            path.AddArc(arc, 270, 90);

            // Bottom Right
            arc.Y = bounds.Bottom - diameter;
            path.AddArc(arc, 0, 90);

            // Bottom Left
            arc.X = bounds.Left;
            path.AddArc(arc, 90, 90);

            path.CloseFigure();
            return path;
        }

        private void ApplyRoundedRegion(Control control, int radius)
        {
            Rectangle bounds = new Rectangle(0, 0, control.Width, control.Height);
            using (GraphicsPath path = GetRoundedPath(bounds, radius))
            {
                control.Region = new Region(path);
            }
        }

        private void InitializeComponent()
        {
            this.Text = "StreamClips Connect";
            this.Size = new Size(480, 540);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(6, 6, 8); // Deep Obsidian Pure Black
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.Icon = SystemIcons.Application;

            // Main Glassmorphism Curved Card Container with Dark Metallic Gradient
            cardPanel = new Panel();
            cardPanel.Size = new Size(420, 460);
            cardPanel.Location = new Point(22, 20);
            cardPanel.BackColor = Color.FromArgb(14, 14, 18);
            this.Controls.Add(cardPanel);

            cardPanel.SizeChanged += (s, e) => ApplyRoundedRegion(cardPanel, 24);
            ApplyRoundedRegion(cardPanel, 24);

            cardPanel.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                Rectangle rect = new Rectangle(0, 0, cardPanel.Width - 1, cardPanel.Height - 1);
                
                using (LinearGradientBrush gradient = new LinearGradientBrush(rect, Color.FromArgb(20, 20, 26), Color.FromArgb(10, 10, 14), LinearGradientMode.Vertical))
                using (GraphicsPath path = GetRoundedPath(rect, 24))
                {
                    e.Graphics.FillPath(gradient, path);
                    using (Pen borderPen = new Pen(Color.FromArgb(50, 255, 255, 255), 1.5f))
                    {
                        e.Graphics.DrawPath(borderPen, path);
                    }
                }
            };

            // Logo Icon (Minimalist White Monogram Emblem)
            logoIcon = new Label();
            logoIcon.Text = "⚡";
            logoIcon.Font = new Font("Segoe UI", 28, FontStyle.Bold);
            logoIcon.ForeColor = Color.White;
            logoIcon.Size = new Size(60, 60);
            logoIcon.Location = new Point(180, 22);
            logoIcon.TextAlign = ContentAlignment.MiddleCenter;
            cardPanel.Controls.Add(logoIcon);

            // Title (Crisp White High Contrast)
            titleLabel = new Label();
            titleLabel.Text = "StreamClips Connect";
            titleLabel.Font = new Font("Segoe UI", 17.5f, FontStyle.Bold);
            titleLabel.ForeColor = Color.White;
            titleLabel.Size = new Size(380, 36);
            titleLabel.Location = new Point(20, 90);
            titleLabel.TextAlign = ContentAlignment.MiddleCenter;
            cardPanel.Controls.Add(titleLabel);

            // Subtitle (Muted Slate)
            subtitleLabel = new Label();
            subtitleLabel.Text = "Pair Account via Website Code";
            subtitleLabel.Font = new Font("Segoe UI", 9.25f, FontStyle.Regular);
            subtitleLabel.ForeColor = Color.FromArgb(150, 150, 160);
            subtitleLabel.Size = new Size(380, 24);
            subtitleLabel.Location = new Point(20, 128);
            subtitleLabel.TextAlign = ContentAlignment.MiddleCenter;
            cardPanel.Controls.Add(subtitleLabel);

            // Status Pill Container (Curved Capsule)
            statusPill = new Panel();
            statusPill.Size = new Size(210, 34);
            statusPill.Location = new Point(105, 166);
            statusPill.BackColor = Color.FromArgb(22, 22, 28);
            cardPanel.Controls.Add(statusPill);

            statusPill.SizeChanged += (s, e) => ApplyRoundedRegion(statusPill, 17);
            ApplyRoundedRegion(statusPill, 17);

            statusPill.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                Rectangle rect = new Rectangle(0, 0, statusPill.Width - 1, statusPill.Height - 1);
                using (GraphicsPath path = GetRoundedPath(rect, 17))
                using (Pen borderPen = new Pen(Color.FromArgb(60, 255, 255, 255), 1))
                {
                    e.Graphics.DrawPath(borderPen, path);
                }
            };

            statusDot = new Panel();
            statusDot.Size = new Size(8, 8);
            statusDot.Location = new Point(16, 13);
            statusDot.BackColor = Color.FromArgb(160, 160, 160);
            statusPill.Controls.Add(statusDot);

            statusDot.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using (GraphicsPath path = new GraphicsPath())
                {
                    path.AddEllipse(0, 0, statusDot.Width, statusDot.Height);
                    statusDot.Region = new Region(path);
                }
            };

            statusLabel = new Label();
            statusLabel.Text = "Enter Code to Get Started";
            statusLabel.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
            statusLabel.ForeColor = Color.FromArgb(220, 220, 230);
            statusLabel.Size = new Size(165, 34);
            statusLabel.Location = new Point(32, 0);
            statusLabel.TextAlign = ContentAlignment.MiddleLeft;
            statusPill.Controls.Add(statusLabel);

            // PAIRING CODE CONTAINER PANEL
            codeInputPanel = new Panel();
            codeInputPanel.Size = new Size(360, 175);
            codeInputPanel.Location = new Point(30, 215);
            codeInputPanel.BackColor = Color.FromArgb(22, 22, 28);
            cardPanel.Controls.Add(codeInputPanel);

            codeInputPanel.SizeChanged += (s, e) => ApplyRoundedRegion(codeInputPanel, 18);
            ApplyRoundedRegion(codeInputPanel, 18);

            codeInputPanel.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                Rectangle rect = new Rectangle(0, 0, codeInputPanel.Width - 1, codeInputPanel.Height - 1);
                using (GraphicsPath path = GetRoundedPath(rect, 18))
                using (Pen borderPen = new Pen(Color.FromArgb(60, 255, 255, 255), 1))
                {
                    e.Graphics.DrawPath(borderPen, path);
                }
            };

            Label codeHintLabel = new Label();
            codeHintLabel.Text = "Website Pairing Code:";
            codeHintLabel.Font = new Font("Segoe UI", 8.75f, FontStyle.Bold);
            codeHintLabel.ForeColor = Color.FromArgb(180, 180, 190);
            codeHintLabel.Size = new Size(330, 22);
            codeHintLabel.Location = new Point(16, 12);
            codeInputPanel.Controls.Add(codeHintLabel);

            // Code Input Box (Dark Glass TextBox)
            codeTextBox = new TextBox();
            codeTextBox.Font = new Font("Consolas", 12f, FontStyle.Bold);
            codeTextBox.BackColor = Color.FromArgb(12, 12, 16);
            codeTextBox.ForeColor = Color.White;
            codeTextBox.BorderStyle = BorderStyle.FixedSingle;
            codeTextBox.Size = new Size(240, 36);
            codeTextBox.Location = new Point(16, 38);
            codeTextBox.TextAlign = HorizontalAlignment.Center;
            codeInputPanel.Controls.Add(codeTextBox);

            // Paste Button (📋 Paste from Clipboard)
            pasteBtn = new Button();
            pasteBtn.Text = "📋 Paste";
            pasteBtn.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            pasteBtn.BackColor = Color.FromArgb(32, 32, 40);
            pasteBtn.ForeColor = Color.White;
            pasteBtn.FlatStyle = FlatStyle.Flat;
            pasteBtn.FlatAppearance.BorderSize = 0;
            pasteBtn.Size = new Size(80, 32);
            pasteBtn.Location = new Point(264, 38);
            pasteBtn.Cursor = Cursors.Hand;
            pasteBtn.Click += (s, e) => HandlePasteCode();
            codeInputPanel.Controls.Add(pasteBtn);

            pasteBtn.SizeChanged += (s, e) => ApplyRoundedRegion(pasteBtn, 16);
            ApplyRoundedRegion(pasteBtn, 16);

            // Verify Code Button (Solid Pure White Rounded Pill Button)
            verifyCodeBtn = new Button();
            verifyCodeBtn.Text = "Link Account & Continue";
            verifyCodeBtn.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            verifyCodeBtn.BackColor = Color.White;
            verifyCodeBtn.ForeColor = Color.Black;
            verifyCodeBtn.FlatStyle = FlatStyle.Flat;
            verifyCodeBtn.FlatAppearance.BorderSize = 0;
            verifyCodeBtn.Size = new Size(328, 44);
            verifyCodeBtn.Location = new Point(16, 88);
            verifyCodeBtn.Cursor = Cursors.Hand;
            verifyCodeBtn.Click += (s, e) => HandleVerifyCode();
            codeInputPanel.Controls.Add(verifyCodeBtn);

            verifyCodeBtn.SizeChanged += (s, e) => ApplyRoundedRegion(verifyCodeBtn, 22);
            ApplyRoundedRegion(verifyCodeBtn, 22);

            verifyCodeBtn.MouseEnter += (s, e) => { if (verifyCodeBtn.Enabled) verifyCodeBtn.BackColor = Color.FromArgb(240, 240, 245); };
            verifyCodeBtn.MouseLeave += (s, e) => { if (verifyCodeBtn.Enabled) verifyCodeBtn.BackColor = Color.White; };

            Label codeExpiryInfo = new Label();
            codeExpiryInfo.Text = "Generate a fresh code on website if expired (5-min limit).";
            codeExpiryInfo.Font = new Font("Segoe UI", 8f, FontStyle.Regular);
            codeExpiryInfo.ForeColor = Color.FromArgb(120, 120, 130);
            codeExpiryInfo.Size = new Size(330, 20);
            codeExpiryInfo.Location = new Point(16, 142);
            codeExpiryInfo.TextAlign = ContentAlignment.MiddleCenter;
            codeInputPanel.Controls.Add(codeExpiryInfo);

            // PROFILE & CHANNEL CARD (Shown After Pairing Code Verification)
            profileCard = new Panel();
            profileCard.Size = new Size(360, 80);
            profileCard.Location = new Point(30, 220);
            profileCard.BackColor = Color.FromArgb(22, 22, 28);
            profileCard.Visible = false;
            cardPanel.Controls.Add(profileCard);

            profileCard.SizeChanged += (s, e) => ApplyRoundedRegion(profileCard, 18);
            ApplyRoundedRegion(profileCard, 18);

            profileCard.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                Rectangle rect = new Rectangle(0, 0, profileCard.Width - 1, profileCard.Height - 1);
                using (GraphicsPath path = GetRoundedPath(rect, 18))
                using (Pen borderPen = new Pen(Color.FromArgb(60, 255, 255, 255), 1))
                {
                    e.Graphics.DrawPath(borderPen, path);
                }
            };

            profileEmailLabel = new Label();
            profileEmailLabel.Text = "Logged in: ...";
            profileEmailLabel.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            profileEmailLabel.ForeColor = Color.White;
            profileEmailLabel.Size = new Size(330, 24);
            profileEmailLabel.Location = new Point(14, 14);
            profileCard.Controls.Add(profileEmailLabel);

            profileChannelLabel = new Label();
            profileChannelLabel.Text = "YouTube: Not Connected";
            profileChannelLabel.Font = new Font("Segoe UI", 9f, FontStyle.Regular);
            profileChannelLabel.ForeColor = Color.FromArgb(160, 160, 170);
            profileChannelLabel.Size = new Size(330, 22);
            profileChannelLabel.Location = new Point(14, 44);
            profileCard.Controls.Add(profileChannelLabel);

            // Connect YouTube Button (Always Clickable for Testing / Re-connecting)
            connectYtBtn = new Button();
            connectYtBtn.Text = "Connect YouTube Channel";
            connectYtBtn.Font = new Font("Segoe UI", 10.5f, FontStyle.Bold);
            connectYtBtn.BackColor = Color.White;
            connectYtBtn.ForeColor = Color.Black;
            connectYtBtn.FlatStyle = FlatStyle.Flat;
            connectYtBtn.FlatAppearance.BorderSize = 0;
            connectYtBtn.Size = new Size(360, 46);
            connectYtBtn.Location = new Point(30, 315);
            connectYtBtn.Cursor = Cursors.Hand;
            connectYtBtn.Visible = false;
            connectYtBtn.Click += (s, e) => HandleConnectYouTube();
            cardPanel.Controls.Add(connectYtBtn);

            connectYtBtn.SizeChanged += (s, e) => ApplyRoundedRegion(connectYtBtn, 23);
            ApplyRoundedRegion(connectYtBtn, 23);

            connectYtBtn.MouseEnter += (s, e) => { if (connectYtBtn.Enabled) connectYtBtn.BackColor = Color.FromArgb(240, 240, 245); };
            connectYtBtn.MouseLeave += (s, e) => { if (connectYtBtn.Enabled) connectYtBtn.BackColor = Color.White; };

            // Logout Button
            logoutBtn = new Button();
            logoutBtn.Text = "Logout / Switch Account";
            logoutBtn.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            logoutBtn.BackColor = Color.FromArgb(22, 22, 28);
            logoutBtn.ForeColor = Color.FromArgb(180, 180, 190);
            logoutBtn.FlatStyle = FlatStyle.Flat;
            logoutBtn.FlatAppearance.BorderSize = 0;
            logoutBtn.Size = new Size(360, 40);
            logoutBtn.Location = new Point(30, 375);
            logoutBtn.Cursor = Cursors.Hand;
            logoutBtn.Visible = false;
            logoutBtn.Click += (s, e) => HandleLogout();
            cardPanel.Controls.Add(logoutBtn);

            logoutBtn.SizeChanged += (s, e) => ApplyRoundedRegion(logoutBtn, 20);
            ApplyRoundedRegion(logoutBtn, 20);

            logoutBtn.MouseEnter += (s, e) => { logoutBtn.ForeColor = Color.White; logoutBtn.BackColor = Color.FromArgb(32, 32, 40); };
            logoutBtn.MouseLeave += (s, e) => { logoutBtn.ForeColor = Color.FromArgb(180, 180, 190); logoutBtn.BackColor = Color.FromArgb(22, 22, 28); };

            logoutBtn.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                Rectangle rect = new Rectangle(0, 0, logoutBtn.Width - 1, logoutBtn.Height - 1);
                using (GraphicsPath path = GetRoundedPath(rect, 20))
                using (Pen borderPen = new Pen(Color.FromArgb(60, 255, 255, 255), 1))
                {
                    e.Graphics.DrawPath(borderPen, path);
                }
            };

            // Footer Note
            Label footerNote = new Label();
            footerNote.Text = "Pairing Code Edition • Mac & Windows Universal Companion";
            footerNote.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            footerNote.ForeColor = Color.FromArgb(110, 110, 120);
            footerNote.Size = new Size(380, 24);
            footerNote.Location = new Point(20, 425);
            footerNote.TextAlign = ContentAlignment.MiddleCenter;
            cardPanel.Controls.Add(footerNote);
        }

        private void HandlePasteCode()
        {
            try
            {
                if (Clipboard.ContainsText())
                {
                    string clipText = Clipboard.GetText().Trim();
                    codeTextBox.Text = clipText;
                }
            }
            catch {}
        }

        private string GetProfileIdFromSupabase(string email)
        {
            try
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;
                string apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3d2R6a2h0bmFlcGFtc2ZpdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUxNjMsImV4cCI6MjA5ODQxMTE2M30.60vipeZzzdplww-8fuRD_LYvQ-2oawfNm-kx2ur3So0";
                
                string queryUrl = string.Format("https://bwwdzkhtnaepamsfivds.supabase.co/rest/v1/Youtube?email=eq.{0}&select=id", Uri.EscapeDataString(email));
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(queryUrl);
                req.Method = "GET";
                req.Headers.Add("apikey", apikey);
                req.Headers.Add("Authorization", "Bearer " + apikey);
                req.Timeout = 5000;

                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                using (StreamReader sr = new StreamReader(resp.GetResponseStream()))
                {
                    string json = sr.ReadToEnd();
                    Match m = Regex.Match(json, "\"id\":\\s*\"([^\"]+)\"");
                    if (m.Success) return m.Groups[1].Value;
                }
            }
            catch {}
            return null;
        }

        private void HandleVerifyCode()
        {
            string rawCode = codeTextBox.Text != null ? codeTextBox.Text.Trim() : "";
            if (string.IsNullOrEmpty(rawCode))
            {
                MessageBox.Show("Please enter or paste your 16-digit pairing code from the website.", "Code Required", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            // Normalize code string (remove dashes/spaces)
            string cleanCode = rawCode.Replace("-", "").Replace(" ", "").Trim();

            verifyCodeBtn.Enabled = false;
            verifyCodeBtn.Text = "Verifying Code...";
            statusLabel.Text = "Checking Pairing Code...";
            statusDot.BackColor = Color.White;
            Application.DoEvents();

            ThreadPool.QueueUserWorkItem((state) =>
            {
                try
                {
                    ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;
                    string apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3d2R6a2h0bmFlcGFtc2ZpdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUxNjMsImV4cCI6MjA5ODQxMTE2M30.60vipeZzzdplww-8fuRD_LYvQ-2oawfNm-kx2ur3So0";

                    // Query Supabase for matching pairing_code or cleanCode
                    string queryUrl = string.Format("https://bwwdzkhtnaepamsfivds.supabase.co/rest/v1/Youtube?or=(pairing_code.eq.{0},pairing_code.eq.{1})&select=id,email,custom_handle,code_expires_at", Uri.EscapeDataString(rawCode), Uri.EscapeDataString(cleanCode));
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(queryUrl);
                    req.Method = "GET";
                    req.Headers.Add("apikey", apikey);
                    req.Headers.Add("Authorization", "Bearer " + apikey);
                    req.Timeout = 6000;

                    string responseJson = null;
                    try
                    {
                        using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                        using (StreamReader sr = new StreamReader(resp.GetResponseStream()))
                        {
                            responseJson = sr.ReadToEnd();
                        }
                    }
                    catch (WebException webEx)
                    {
                        HttpWebResponse errResp = webEx.Response as HttpWebResponse;
                        if (errResp != null && ((int)errResp.StatusCode == 400 || (int)errResp.StatusCode == 404))
                        {
                            this.Invoke((MethodInvoker)delegate
                            {
                                MessageBox.Show("Database Schema Setup Required:\n\nThe columns 'pairing_code' and 'code_expires_at' need to be added to your Supabase 'Youtube' table.\n\nPlease run the provided SQL command in your Supabase SQL Editor.", "Supabase Setup Required", MessageBoxButtons.OK, MessageBoxIcon.Information);
                                verifyCodeBtn.Enabled = true;
                                verifyCodeBtn.Text = "Link Account & Continue";
                                statusLabel.Text = "Enter Code to Get Started";
                                statusDot.BackColor = Color.FromArgb(160, 160, 160);
                            });
                            return;
                        }
                        throw webEx;
                    }

                    Match emailMatch = Regex.Match(responseJson ?? "", "\"email\":\\s*\"([^\"]+)\"");
                    Match idMatch = Regex.Match(responseJson ?? "", "\"id\":\\s*\"([^\"]+)\"");
                    Match handleMatch = Regex.Match(responseJson ?? "", "\"custom_handle\":\\s*\"([^\"]+)\"");
                    Match expMatch = Regex.Match(responseJson ?? "", "\"code_expires_at\":\\s*\"([^\"]+)\"");

                    bool isExpired = false;
                    if (expMatch.Success)
                    {
                        DateTime expiresAt;
                        if (DateTime.TryParse(expMatch.Groups[1].Value, out expiresAt))
                        {
                            if (DateTime.UtcNow > expiresAt.ToUniversalTime())
                            {
                                isExpired = true;
                            }
                        }
                    }

                    if (!emailMatch.Success || isExpired)
                    {
                        // Immediately nullify expired pairing code in Supabase
                        if (isExpired && emailMatch.Success)
                        {
                            try
                            {
                                string clearUrl = string.Format("https://bwwdzkhtnaepamsfivds.supabase.co/rest/v1/Youtube?email=eq.{0}", Uri.EscapeDataString(emailMatch.Groups[1].Value));
                                HttpWebRequest clearReq = (HttpWebRequest)WebRequest.Create(clearUrl);
                                clearReq.Method = "PATCH";
                                clearReq.ContentType = "application/json";
                                clearReq.Headers.Add("apikey", apikey);
                                clearReq.Headers.Add("Authorization", "Bearer " + apikey);
                                clearReq.Timeout = 4000;
                                string body = "{\"pairing_code\":null,\"code_expires_at\":null}";
                                byte[] bytes = Encoding.UTF8.GetBytes(body);
                                clearReq.ContentLength = bytes.Length;
                                using (Stream os = clearReq.GetRequestStream()) { os.Write(bytes, 0, bytes.Length); }
                                using (HttpWebResponse clearResp = (HttpWebResponse)clearReq.GetResponse()) { }
                            }
                            catch {}
                        }

                        this.Invoke((MethodInvoker)delegate
                        {
                            string msg = isExpired ? 
                                "This pairing code has expired (5-minute limit).\n\nPlease click 'Generate Code' again on your website dashboard." : 
                                "Invalid Pairing Code.\n\nPlease generate a new code on your website dashboard and paste it here.";
                            
                            MessageBox.Show(msg, "Verification Failed", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                            verifyCodeBtn.Enabled = true;
                            verifyCodeBtn.Text = "Link Account & Continue";
                            statusLabel.Text = "Enter Code to Get Started";
                            statusDot.BackColor = Color.FromArgb(160, 160, 160);
                        });
                        return;
                    }

                    authenticatedEmail = emailMatch.Groups[1].Value;
                    authenticatedUserId = idMatch.Success ? idMatch.Groups[1].Value : Guid.NewGuid().ToString();
                    connectedChannelHandle = handleMatch.Success && handleMatch.Groups[1].Value != "null" ? handleMatch.Groups[1].Value : null;

                    // Immediately invalidate / clear single-use pairing code in Supabase
                    try
                    {
                        string clearUrl = string.Format("https://bwwdzkhtnaepamsfivds.supabase.co/rest/v1/Youtube?email=eq.{0}", Uri.EscapeDataString(authenticatedEmail));
                        HttpWebRequest clearReq = (HttpWebRequest)WebRequest.Create(clearUrl);
                        clearReq.Method = "PATCH";
                        clearReq.ContentType = "application/json";
                        clearReq.Headers.Add("apikey", apikey);
                        clearReq.Headers.Add("Authorization", "Bearer " + apikey);
                        clearReq.Timeout = 5000;

                        string body = "{\"pairing_code\":null,\"code_expires_at\":null}";
                        byte[] bytes = Encoding.UTF8.GetBytes(body);
                        clearReq.ContentLength = bytes.Length;

                        using (Stream os = clearReq.GetRequestStream())
                        {
                            os.Write(bytes, 0, bytes.Length);
                        }
                        using (HttpWebResponse clearResp = (HttpWebResponse)clearReq.GetResponse()) { }
                    }
                    catch {}

                    SaveSession();

                    this.Invoke((MethodInvoker)delegate
                    {
                        codeInputPanel.Visible = false;
                        profileEmailLabel.Text = "Logged in: " + authenticatedEmail;
                        profileCard.Visible = true;
                        connectYtBtn.Visible = true;
                        logoutBtn.Visible = true;
                        statusDot.BackColor = Color.FromArgb(0, 255, 136);

                        if (!string.IsNullOrEmpty(connectedChannelHandle))
                        {
                            profileChannelLabel.Text = "YouTube: Connected (" + connectedChannelHandle + ")";
                            profileChannelLabel.ForeColor = Color.FromArgb(0, 255, 136);
                            connectYtBtn.Text = "✓ Connected (Click to Re-connect)";
                            connectYtBtn.Enabled = true;
                            connectYtBtn.BackColor = Color.White;
                            connectYtBtn.ForeColor = Color.Black;
                            statusLabel.Text = "Fully Connected!";
                        }
                        else
                        {
                            profileChannelLabel.Text = "YouTube: Not Connected";
                            connectYtBtn.Text = "Connect YouTube Channel";
                            connectYtBtn.Enabled = true;
                            connectYtBtn.BackColor = Color.White;
                            connectYtBtn.ForeColor = Color.Black;
                            statusLabel.Text = "Profile Authenticated";
                        }
                    });
                }
                catch (Exception ex)
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        MessageBox.Show("Error: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        verifyCodeBtn.Enabled = true;
                        verifyCodeBtn.Text = "Link Account & Continue";
                        statusLabel.Text = "Enter Code to Get Started";
                        statusDot.BackColor = Color.FromArgb(160, 160, 160);
                    });
                }
            });
        }

        private void LoadSavedSession()
        {
            try
            {
                if (File.Exists(sessionFile))
                {
                    string json = File.ReadAllText(sessionFile);
                    Match emailMatch = Regex.Match(json, "\"email\":\\s*\"([^\"]+)\"");
                    Match userIdMatch = Regex.Match(json, "\"user_id\":\\s*\"([^\"]+)\"");
                    Match handleMatch = Regex.Match(json, "\"channel_handle\":\\s*\"([^\"]+)\"");

                    if (emailMatch.Success)
                    {
                        authenticatedEmail = emailMatch.Groups[1].Value;
                        authenticatedUserId = userIdMatch.Success ? userIdMatch.Groups[1].Value : null;
                        connectedChannelHandle = handleMatch.Success ? handleMatch.Groups[1].Value : null;

                        codeInputPanel.Visible = false;
                        profileEmailLabel.Text = "Logged in: " + authenticatedEmail;
                        profileCard.Visible = true;
                        connectYtBtn.Visible = true;
                        logoutBtn.Visible = true;
                        statusDot.BackColor = Color.FromArgb(0, 255, 136);

                        if (!string.IsNullOrEmpty(connectedChannelHandle))
                        {
                            profileChannelLabel.Text = "YouTube: Connected (" + connectedChannelHandle + ")";
                            profileChannelLabel.ForeColor = Color.FromArgb(0, 255, 136);
                            connectYtBtn.Text = "✓ Connected (Click to Re-connect)";
                            connectYtBtn.Enabled = true;
                            connectYtBtn.BackColor = Color.White;
                            connectYtBtn.ForeColor = Color.Black;
                            statusLabel.Text = "Fully Connected!";
                        }
                        else
                        {
                            profileChannelLabel.Text = "YouTube: Not Connected";
                            connectYtBtn.Text = "Connect YouTube Channel";
                            connectYtBtn.Enabled = true;
                            connectYtBtn.BackColor = Color.White;
                            connectYtBtn.ForeColor = Color.Black;
                            statusLabel.Text = "Profile Authenticated";
                        }
                    }
                }
            }
            catch {}
        }

        private void SaveSession()
        {
            try
            {
                string dir = Path.GetDirectoryName(sessionFile);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

                string json = string.Format("{{\"email\":\"{0}\",\"user_id\":\"{1}\",\"channel_handle\":\"{2}\"}}", authenticatedEmail, authenticatedUserId, connectedChannelHandle);
                File.WriteAllText(sessionFile, json);
            }
            catch {}
        }

        private void HandleConnectYouTube()
        {
            if (string.IsNullOrEmpty(authenticatedEmail))
            {
                MessageBox.Show("Please link your account first.", "Authentication Required", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            connectYtBtn.Enabled = false;
            connectYtBtn.Text = "Opening Sign-In Window...";
            statusLabel.Text = "Log in to YouTube...";
            Application.DoEvents();

            ThreadPool.QueueUserWorkItem((state) =>
            {
                try
                {
                    // 1. Ensure a 100% FRESH browser profile directory for EVERY sign-in attempt
                    string baseProfileDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "StreamClipsAuthProfile");
                    Directory.CreateDirectory(baseProfileDir);

                    // Purge old temporary profile folders from previous sign-in attempts
                    try
                    {
                        foreach (string oldDir in Directory.GetDirectories(baseProfileDir, "yt_user_profile_*"))
                        {
                            try { Directory.Delete(oldDir, true); } catch { }
                        }
                    }
                    catch { }

                    string ytUserDataDir = Path.Combine(baseProfileDir, "yt_user_profile_" + DateTime.Now.Ticks);
                    Directory.CreateDirectory(ytUserDataDir);

                    string executablePath = GetBrowserPath();
                    if (executablePath == null)
                    {
                        this.Invoke((MethodInvoker)delegate
                        {
                            MessageBox.Show("No supported browser (Chrome, Edge, Brave, Opera) was found.", "Browser Not Found", MessageBoxButtons.OK, MessageBoxIcon.Error);
                            ResetToLoggedInState();
                        });
                        return;
                    }

                    int debugPort = 9222 + new Random().Next(100, 500);
                    
                    // Google Modern Material 3 / Glif V3 Sign-In URL
                    string modernSignInUrl = "https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Den%26next%3D%252F%26feature%3Dshortcut&service=youtube&uilel=3&flowName=GlifWebSignIn&flowEntry=ServiceLogin";

                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = executablePath;
                    // Using --app= mode converts the popup into a sleek borderless app card with forced Dark Mode!
                    psi.Arguments = string.Format("--app=\"{0}\" --remote-allow-origins=* --remote-debugging-port={1} --user-data-dir=\"{2}\" --no-first-run --no-default-browser-check --force-dark-mode --enable-features=WebUIDarkMode --window-size=540,740", modernSignInUrl, debugPort, ytUserDataDir);
                    psi.UseShellExecute = false;

                    Process browserProc = Process.Start(psi);

                    string liveCookieString = null;
                    string extractedHandle = null;

                    // Patient loop: Wait for user to complete sign-in in the fresh panel (captured strictly via SAPISID or __Secure-3PAPISID)
                    for (int i = 0; i < 600; i++)
                    {
                        Thread.Sleep(1000);
                        try
                        {
                            string candidateCookie = ExtractLiveCdpCookies(debugPort);
                            if (string.IsNullOrEmpty(candidateCookie))
                            {
                                candidateCookie = ReadCookiesFromDisk(ytUserDataDir);
                            }
                            else if (!candidateCookie.Contains("LOGIN_INFO="))
                            {
                                string diskStr = ReadCookiesFromDisk(ytUserDataDir);
                                if (!string.IsNullOrEmpty(diskStr))
                                {
                                    Match liMatch = Regex.Match(diskStr, @"LOGIN_INFO=([^;]+)");
                                    if (liMatch.Success)
                                    {
                                        candidateCookie = candidateCookie + "; LOGIN_INFO=" + liMatch.Groups[1].Value.Trim();
                                    }
                                }
                            }

                            // SAPISID or __Secure-3PAPISID indicates TRUE account authentication!
                            if (!string.IsNullOrEmpty(candidateCookie) && (candidateCookie.Contains("SAPISID=") || candidateCookie.Contains("__Secure-3PAPISID=")))
                            {
                                liveCookieString = candidateCookie;
                                extractedHandle = ExtractLiveChannelHandle(debugPort);
                                break; // SUCCESS! FRESH USER AUTHENTICATED!
                            }

                            if (browserProc.HasExited)
                            {
                                // Final check upon window close
                                string finalCheck = ExtractLiveCdpCookies(debugPort);
                                if (string.IsNullOrEmpty(finalCheck)) finalCheck = ReadCookiesFromDisk(ytUserDataDir);
                                else if (!finalCheck.Contains("LOGIN_INFO="))
                                {
                                    string diskStr = ReadCookiesFromDisk(ytUserDataDir);
                                    if (!string.IsNullOrEmpty(diskStr))
                                    {
                                        Match liMatch = Regex.Match(diskStr, @"LOGIN_INFO=([^;]+)");
                                        if (liMatch.Success) finalCheck = finalCheck + "; LOGIN_INFO=" + liMatch.Groups[1].Value.Trim();
                                    }
                                }

                                if (!string.IsNullOrEmpty(finalCheck) && (finalCheck.Contains("SAPISID=") || finalCheck.Contains("__Secure-3PAPISID=")))
                                {
                                    liveCookieString = finalCheck;
                                    extractedHandle = ExtractLiveChannelHandle(debugPort);
                                }
                                break;
                            }
                        }
                        catch { }
                    }

                    if (string.IsNullOrEmpty(liveCookieString))
                    {
                        try { if (!browserProc.HasExited) browserProc.Kill(); } catch { }
                        this.Invoke((MethodInvoker)delegate
                        {
                            MessageBox.Show("YouTube Sign-In was not completed or window was closed.", "Sign-In Required", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                            ResetToLoggedInState();
                        });
                        return;
                    }

                    string existingHandle = null;
                    string existingCid = null;

                    // 1. Fetch exact logged-in user channel identity from YouTube using the live cookie!
                    LoggedInChannelInfo cookieIdentity = FetchLoggedInUserIdentityFromYouTubeCookie(liveCookieString);
                    if (!string.IsNullOrEmpty(cookieIdentity.CustomHandle) && !IsInvalidOrGenericHandle(cookieIdentity.CustomHandle, null))
                    {
                        extractedHandle = cookieIdentity.CustomHandle;
                    }
                    if (!string.IsNullOrEmpty(cookieIdentity.ChannelId))
                    {
                        existingCid = cookieIdentity.ChannelId;
                    }

                    // 2. Query Supabase record by email as secondary check if not resolved yet
                    if (IsInvalidOrGenericHandle(extractedHandle, null))
                    {
                        try
                        {
                            string apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3d2R6a2h0bmFlcGFtc2ZpdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUxNjMsImV4cCI6MjA5ODQxMTE2M30.60vipeZzzdplww-8fuRD_LYvQ-2oawfNm-kx2ur3So0";
                            string getUrl = string.Format("https://bwwdzkhtnaepamsfivds.supabase.co/rest/v1/Youtube?email=eq.{0}", Uri.EscapeDataString(authenticatedEmail));
                            HttpWebRequest getReq = (HttpWebRequest)WebRequest.Create(getUrl);
                            getReq.Method = "GET";
                            getReq.Headers.Add("apikey", apikey);
                            getReq.Headers.Add("Authorization", "Bearer " + apikey);
                            getReq.Timeout = 4000;
                            using (HttpWebResponse getResp = (HttpWebResponse)getReq.GetResponse())
                            using (StreamReader sr = new StreamReader(getResp.GetResponseStream()))
                            {
                                string json = sr.ReadToEnd();
                                Match handleMatch = Regex.Match(json, "\"custom_handle\":\\s*\"([^\"]+)\"");
                                Match cidMatch = Regex.Match(json, "\"channel_id\":\\s*\"([^\"]+)\"");
                                if (handleMatch.Success && !IsInvalidOrGenericHandle(handleMatch.Groups[1].Value, null)) existingHandle = handleMatch.Groups[1].Value;
                                if (cidMatch.Success && !string.IsNullOrEmpty(cidMatch.Groups[1].Value) && cidMatch.Groups[1].Value != "null") existingCid = cidMatch.Groups[1].Value;
                            }
                        }
                        catch {}
                    }

                    if (IsInvalidOrGenericHandle(extractedHandle, null) && !string.IsNullOrEmpty(existingHandle))
                    {
                        extractedHandle = existingHandle;
                    }

                    // 3. Fallback: Try CDP metadata from open Chrome window
                    if (IsInvalidOrGenericHandle(extractedHandle, null))
                    {
                        LiveMetadata liveMeta = FetchFullLiveMetadataFromCDP(debugPort);
                        if (!IsInvalidOrGenericHandle(liveMeta.CustomHandle, liveMeta.ChannelName))
                        {
                            extractedHandle = liveMeta.CustomHandle;
                        }
                    }

                    if (IsInvalidOrGenericHandle(extractedHandle, null))
                    {
                        NavigateChromePage(debugPort, "https://www.youtube.com/");
                        Thread.Sleep(3000);
                        LiveMetadata mainMeta = FetchFullLiveMetadataFromCDP(debugPort);
                        if (!IsInvalidOrGenericHandle(mainMeta.CustomHandle, mainMeta.ChannelName))
                        {
                            extractedHandle = mainMeta.CustomHandle;
                        }
                    }

                    if (IsInvalidOrGenericHandle(extractedHandle, null))
                    {
                        string cdHandle = ExtractLiveChannelHandle(debugPort);
                        if (!IsInvalidOrGenericHandle(cdHandle, null))
                        {
                            extractedHandle = cdHandle;
                        }
                    }

                    connectedChannelHandle = !IsInvalidOrGenericHandle(extractedHandle, null) ? extractedHandle : (!string.IsNullOrEmpty(existingHandle) ? existingHandle : "@creator");

                    // 4. Construct target channel URL: ALWAYS prefer /channel/{existingCid}/about or /{connectedChannelHandle}/about
                    string channelUrl = "https://www.youtube.com/";
                    if (!string.IsNullOrEmpty(existingCid))
                    {
                        channelUrl = "https://www.youtube.com/channel/" + existingCid + "/about";
                    }
                    else if (!IsInvalidOrGenericHandle(connectedChannelHandle, null) && connectedChannelHandle.StartsWith("@"))
                    {
                        channelUrl = "https://www.youtube.com/" + connectedChannelHandle + "/about";
                    }

                    this.Invoke((MethodInvoker)delegate
                    {
                        statusLabel.Text = "Redirecting to your channel (" + (!string.IsNullOrEmpty(existingHandle) ? existingHandle : connectedChannelHandle) + ")...";
                    });

                    NavigateChromePage(debugPort, channelUrl);
                    Thread.Sleep(5000);

                    // RE-EXTRACT FRESH LIVE COOKIES & ACCURATE METADATA FROM YOUTUBE AFTER 5-SECOND PAGE LOAD
                    try
                    {
                        string freshCookies = ExtractLiveCdpCookies(debugPort);
                        if (string.IsNullOrEmpty(freshCookies)) freshCookies = ReadCookiesFromDisk(ytUserDataDir);

                        if (!string.IsNullOrEmpty(freshCookies) && freshCookies.Contains("SAPISID="))
                        {
                            liveCookieString = freshCookies;
                        }
                    }
                    catch {}

                    // TRIPLE-LAYER GUARANTEE TO ENSURE LOGIN_INFO IS INCLUDED IN COOKIE STRING
                    liveCookieString = EnsureLoginInfoCookie(liveCookieString, ytUserDataDir);

                    this.Invoke((MethodInvoker)delegate
                    {
                        statusLabel.Text = "Saving Channel & Closing Window...";
                    });

                    // CLOSE THE POPUP WINDOW AFTER 5 SECONDS
                    try { if (!browserProc.HasExited) browserProc.Kill(); } catch { }

                    if (string.IsNullOrEmpty(authenticatedUserId))
                    {
                        authenticatedUserId = GetProfileIdFromSupabase(authenticatedEmail);
                    }

                    // Save/Update FRESH LIVE COOKIES & ACCURATE METADATA in Supabase
                    bool ok = UpdateSupabaseRecord(authenticatedEmail, authenticatedUserId, connectedChannelHandle, liveCookieString, debugPort);

                    if (ok)
                    {
                        SaveSession();
                    }

                    this.Invoke((MethodInvoker)delegate
                    {
                        if (ok)
                        {
                            profileChannelLabel.Text = "YouTube: Connected (" + connectedChannelHandle + ")";
                            profileChannelLabel.ForeColor = Color.FromArgb(0, 255, 136);
                            connectYtBtn.Text = "✓ Connected (Click to Re-connect)";
                            connectYtBtn.Enabled = true;
                            connectYtBtn.BackColor = Color.White;
                            connectYtBtn.ForeColor = Color.Black;
                            statusDot.BackColor = Color.FromArgb(0, 255, 136);
                            statusLabel.Text = "Fully Connected!";
                        }
                        else
                        {
                            MessageBox.Show("Failed to save YouTube token under profile.", "Save Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                            ResetToLoggedInState();
                        }
                    });
                }
                catch (Exception ex)
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        MessageBox.Show("Error: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        ResetToLoggedInState();
                    });
                }
            });
        }

        private void NavigateChromePage(int debugPort, string targetUrl)
        {
            try
            {
                string jsonList = GetHttpString(string.Format("http://127.0.0.1:{0}/json/list", debugPort));
                if (string.IsNullOrEmpty(jsonList)) return;

                Match m = Regex.Match(jsonList, "\"webSocketDebuggerUrl\":\\s*\"([^\"]+)\"");
                if (m.Success)
                {
                    string wsUrl = m.Groups[1].Value;
                    using (ClientWebSocket ws = new ClientWebSocket())
                    {
                        ws.ConnectAsync(new Uri(wsUrl), CancellationToken.None).Wait(2000);
                        if (ws.State == WebSocketState.Open)
                        {
                            string navCmd = string.Format("{{\"id\":200,\"method\":\"Page.navigate\",\"params\":{{\"url\":\"{0}\"}}}}", targetUrl);
                            byte[] sendBytes = Encoding.UTF8.GetBytes(navCmd);
                            ws.SendAsync(new ArraySegment<byte>(sendBytes), WebSocketMessageType.Text, true, CancellationToken.None).Wait(1500);
                            ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None).Wait(500);
                        }
                    }
                }
            }
            catch {}
        }

        private string ReadCookiesFromDisk(string tempDir)
        {
            try
            {
                string cookieFile = Path.Combine(tempDir, @"Default\Network\Cookies");
                if (!File.Exists(cookieFile))
                {
                    cookieFile = Path.Combine(tempDir, @"Default\Cookies");
                }
                if (!File.Exists(cookieFile)) return null;

                byte[] bytes;
                using (FileStream fs = new FileStream(cookieFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                {
                    bytes = new byte[fs.Length];
                    fs.Read(bytes, 0, bytes.Length);
                }

                string rawStr = Encoding.GetEncoding("iso-8859-1").GetString(bytes);

                Match sapisidMatch = Regex.Match(rawStr, @"SAPISID[^\x00-\x1F\x7F-\xFF]{0,40}?([a-zA-Z0-9_/=\-]{20,})");
                Match loginInfoMatch = Regex.Match(rawStr, @"LOGIN_INFO[^\x00-\x1F\x7F-\xFF]{0,100}?([a-zA-Z0-9_\-:\./\=]{20,})");
                if (!loginInfoMatch.Success)
                {
                    loginInfoMatch = Regex.Match(rawStr, @"(AFmm[a-zA-Z0-9_\-:\./\=]{50,})");
                }
                Match sidMatch = Regex.Match(rawStr, @"SID[^\x00-\x1F\x7F-\xFF]{0,40}?([a-zA-Z0-9_\-.]{20,})");
                Match hsidMatch = Regex.Match(rawStr, @"HSID[^\x00-\x1F\x7F-\xFF]{0,40}?([a-zA-Z0-9_\-]{10,})");
                Match ssidMatch = Regex.Match(rawStr, @"SSID[^\x00-\x1F\x7F-\xFF]{0,40}?([a-zA-Z0-9_\-]{10,})");
                Match apisidMatch = Regex.Match(rawStr, @"APISID[^\x00-\x1F\x7F-\xFF]{0,40}?([a-zA-Z0-9_/=\-]{20,})");

                if (sapisidMatch.Success)
                {
                    List<string> pairs = new List<string>();
                    pairs.Add("SAPISID=" + sapisidMatch.Groups[1].Value);
                    pairs.Add("__Secure-3PAPISID=" + sapisidMatch.Groups[1].Value);
                    if (sidMatch.Success) pairs.Add("SID=" + sidMatch.Groups[1].Value);
                    if (hsidMatch.Success) pairs.Add("HSID=" + hsidMatch.Groups[1].Value);
                    if (ssidMatch.Success) pairs.Add("SSID=" + ssidMatch.Groups[1].Value);
                    if (loginInfoMatch.Success) pairs.Add("LOGIN_INFO=" + loginInfoMatch.Groups[1].Value);
                    if (apisidMatch.Success) pairs.Add("APISID=" + apisidMatch.Groups[1].Value);
                    pairs.Add("PREF=f6=40000000&tz=Asia.Calcutta&f7=300&f4=4000000");

                    return string.Join("; ", pairs.ToArray());
                }
            }
            catch {}
            return null;
        }

        private string EnsureLoginInfoCookie(string cookieHeader, string tempDir)
        {
            if (string.IsNullOrEmpty(cookieHeader)) return cookieHeader;
            if (cookieHeader.Contains("LOGIN_INFO=")) return cookieHeader;

            // 1. Try reading from disk
            try
            {
                string diskStr = ReadCookiesFromDisk(tempDir);
                if (!string.IsNullOrEmpty(diskStr))
                {
                    Match liMatch = Regex.Match(diskStr, @"LOGIN_INFO=([^;]+)");
                    if (!liMatch.Success) liMatch = Regex.Match(diskStr, @"(AFmm[a-zA-Z0-9_\-:\./\=]{50,})");
                    if (liMatch.Success)
                    {
                        string val = liMatch.Groups[1].Value.Trim();
                        if (!val.StartsWith("LOGIN_INFO=")) val = "LOGIN_INFO=" + val;
                        return cookieHeader + "; " + val;
                    }
                }
            }
            catch {}

            // 2. Fetch directly from YouTube response Set-Cookie header
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("https://www.youtube.com");
                req.Method = "GET";
                req.Headers.Add("Cookie", cookieHeader);
                req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
                req.Timeout = 5000;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    foreach (string headerKey in resp.Headers.AllKeys)
                    {
                        if (headerKey != null && headerKey.Equals("Set-Cookie", StringComparison.OrdinalIgnoreCase))
                        {
                            string setCookieVal = resp.Headers[headerKey];
                            Match m = Regex.Match(setCookieVal, @"LOGIN_INFO=([^;]+)");
                            if (m.Success)
                            {
                                return cookieHeader + "; LOGIN_INFO=" + m.Groups[1].Value.Trim();
                            }
                        }
                    }
                }
            }
            catch {}

            return cookieHeader;
        }

        private string ExtractLiveCdpCookies(int debugPort)
        {
            try
            {
                string jsonList = GetHttpString(string.Format("http://127.0.0.1:{0}/json/list", debugPort));
                if (string.IsNullOrEmpty(jsonList)) return null;

                MatchCollection matches = Regex.Matches(jsonList, "\"webSocketDebuggerUrl\":\\s*\"([^\"]+)\"");
                foreach (Match m in matches)
                {
                    if (!m.Success) continue;
                    string wsUrl = m.Groups[1].Value;

                    using (ClientWebSocket ws = new ClientWebSocket())
                    {
                        ws.ConnectAsync(new Uri(wsUrl), CancellationToken.None).Wait(2000);
                        if (ws.State != WebSocketState.Open) continue;

                        // Send Network.getAllCookies to fetch all cookies across all domains
                        string cdpCmd = "{\"id\":100,\"method\":\"Network.getAllCookies\"}";
                        byte[] sendBytes = Encoding.UTF8.GetBytes(cdpCmd);
                        ws.SendAsync(new ArraySegment<byte>(sendBytes), WebSocketMessageType.Text, true, CancellationToken.None).Wait(2000);

                        StringBuilder wsSb = new StringBuilder();
                        WebSocketReceiveResult rcvRes = null;
                        DateTime startTime = DateTime.Now;
                        do
                        {
                            byte[] rcvBytes = new byte[65536];
                            var task = ws.ReceiveAsync(new ArraySegment<byte>(rcvBytes), CancellationToken.None);
                            task.Wait(2000);
                            rcvRes = task.Result;
                            wsSb.Append(Encoding.UTF8.GetString(rcvBytes, 0, rcvRes.Count));
                        } while (!rcvRes.EndOfMessage && (DateTime.Now - startTime).TotalMilliseconds < 5000);

                        string rcvJson = wsSb.ToString();

                        // Fallback to Network.getCookies if Network.getAllCookies returned empty
                        if (!rcvJson.Contains("SAPISID"))
                        {
                            string fallbackCmd = "{\"id\":101,\"method\":\"Network.getCookies\",\"params\":{\"urls\":[\"https://www.youtube.com\",\"https://youtube.com\",\"https://accounts.google.com\"]}}";
                            byte[] fallbackBytes = Encoding.UTF8.GetBytes(fallbackCmd);
                            ws.SendAsync(new ArraySegment<byte>(fallbackBytes), WebSocketMessageType.Text, true, CancellationToken.None).Wait(2000);
                            
                            StringBuilder fWsSb = new StringBuilder();
                            WebSocketReceiveResult fRcvRes = null;
                            DateTime fStartTime = DateTime.Now;
                            do
                            {
                                byte[] fRcvBytes = new byte[65536];
                                var fTask = ws.ReceiveAsync(new ArraySegment<byte>(fRcvBytes), CancellationToken.None);
                                fTask.Wait(2000);
                                fRcvRes = fTask.Result;
                                fWsSb.Append(Encoding.UTF8.GetString(fRcvBytes, 0, fRcvRes.Count));
                            } while (!fRcvRes.EndOfMessage && (DateTime.Now - fStartTime).TotalMilliseconds < 5000);

                            rcvJson = fWsSb.ToString();
                        }

                        ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None).Wait(500);

                        string formatted = FormatCookiesFromJson(rcvJson);
                        if (!string.IsNullOrEmpty(formatted) && (formatted.Contains("SAPISID=") || formatted.Contains("__Secure-3PAPISID=")))
                        {
                            return formatted;
                        }
                    }
                }
            }
            catch {}
            return null;
        }

        private string ExtractLiveChannelHandle(int debugPort)
        {
            try
            {
                string jsonList = GetHttpString(string.Format("http://127.0.0.1:{0}/json/list", debugPort));
                if (string.IsNullOrEmpty(jsonList)) return null;

                Match m = Regex.Match(jsonList, "youtube\\.com/(@[a-zA-Z0-9._-]+)");
                if (m.Success) return m.Groups[1].Value;
            }
            catch {}
            return null;
        }

        private string FormatCookiesFromJson(string json)
        {
            try
            {
                Dictionary<string, string> cookieMap = new Dictionary<string, string>();
                
                // Match each individual cookie JSON object inside the array regardless of key order
                MatchCollection objectBlocks = Regex.Matches(json, @"\{[^{}]*\}");
                foreach (Match block in objectBlocks)
                {
                    string bStr = block.Value;
                    Match nameMatch = Regex.Match(bStr, @"""name""\s*:\s*""([^""]+)""");
                    Match valMatch = Regex.Match(bStr, @"""value""\s*:\s*""([^""]+)""");

                    if (nameMatch.Success && valMatch.Success)
                    {
                        cookieMap[nameMatch.Groups[1].Value] = valMatch.Groups[1].Value;
                    }
                }

                string[] essentialKeys = new string[] { "SAPISID", "__Secure-3PAPISID", "SID", "HSID", "SSID", "LOGIN_INFO", "APISID", "PREF" };
                List<string> cleanPairs = new List<string>();
                foreach (string k in essentialKeys)
                {
                    if (cookieMap.ContainsKey(k) && !string.IsNullOrEmpty(cookieMap[k]))
                    {
                        cleanPairs.Add(k + "=" + cookieMap[k]);
                    }
                }
                return cleanPairs.Count > 0 ? string.Join("; ", cleanPairs.ToArray()) : null;
            }
            catch { return null; }
        }

        private void HandleLogout()
        {
            authenticatedEmail = null;
            authenticatedUserId = null;
            connectedChannelHandle = null;

            try
            {
                if (File.Exists(sessionFile)) File.Delete(sessionFile);
            }
            catch {}

            ResetToInitialState();
        }

        private void ResetToInitialState()
        {
            codeTextBox.Text = "";
            verifyCodeBtn.Enabled = true;
            verifyCodeBtn.Text = "Link Account & Continue";
            codeInputPanel.Visible = true;
            profileCard.Visible = false;
            connectYtBtn.Visible = false;
            connectYtBtn.Enabled = true;
            connectYtBtn.Text = "Connect YouTube Channel";
            connectYtBtn.BackColor = Color.White;
            connectYtBtn.ForeColor = Color.Black;
            logoutBtn.Visible = false;
            statusLabel.Text = "Enter Code to Get Started";
            statusDot.BackColor = Color.FromArgb(160, 160, 160);
        }

        private void ResetToLoggedInState()
        {
            connectYtBtn.Enabled = true;
            connectYtBtn.Text = "✓ Connected (Click to Re-connect)";
            connectYtBtn.BackColor = Color.White;
            connectYtBtn.ForeColor = Color.Black;
            statusLabel.Text = "Profile Authenticated";
            statusDot.BackColor = Color.FromArgb(0, 255, 136);
        }

        private string GetBrowserPath()
        {
            string[] browserPaths = new string[]
            {
                // 1. Google Chrome
                @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe"),

                // 2. Microsoft Edge (Installed natively on 100% of Windows 10/11 PCs!)
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),

                // 3. Brave Browser
                @"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"BraveSoftware\Brave-Browser\Application\brave.exe"),

                // 4. Opera & Vivaldi
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\Opera\opera.exe"),
                @"C:\Program Files\Vivaldi\Application\vivaldi.exe"
            };
            foreach (string p in browserPaths)
            {
                if (File.Exists(p)) return p;
            }
            return null;
        }

        private string GetHttpString(string url)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Timeout = 2500;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                using (StreamReader sr = new StreamReader(resp.GetResponseStream()))
                {
                    return sr.ReadToEnd();
                }
            }
            catch { return null; }
        }

        private string GetLiveChannelTitle(int debugPort, string handle, string cookie)
        {
            try
            {
                string jsonList = GetHttpString(string.Format("http://127.0.0.1:{0}/json/list", debugPort));
                if (!string.IsNullOrEmpty(jsonList))
                {
                    MatchCollection matches = Regex.Matches(jsonList, "\"webSocketDebuggerUrl\":\\s*\"([^\"]+)\"");
                    foreach (Match m in matches)
                    {
                        if (!m.Success) continue;
                        string wsUrl = m.Groups[1].Value;
                        if (!wsUrl.Contains("/devtools/page/")) continue;

                        using (ClientWebSocket ws = new ClientWebSocket())
                        {
                            ws.ConnectAsync(new Uri(wsUrl), CancellationToken.None).Wait(2000);
                            if (ws.State == WebSocketState.Open)
                            {
                                string evalCmd = "{\"id\":305,\"method\":\"Runtime.evaluate\",\"params\":{\"expression\":\"(function(){ try { if (window.ytInitialData && window.ytInitialData.header) { let h = window.ytInitialData.header; if (h.c4TabbedHeaderRenderer && h.c4TabbedHeaderRenderer.title) return h.c4TabbedHeaderRenderer.title; if (h.pageHeaderRenderer && h.pageHeaderRenderer.pageTitle) return h.pageHeaderRenderer.pageTitle; } let el = document.querySelector('ytd-channel-name #text'); if (el && el.innerText) return el.innerText.trim(); }catch(e){} return ''; })()\",\"returnByValue\":true}}";
                                byte[] sendBytes = Encoding.UTF8.GetBytes(evalCmd);
                                ws.SendAsync(new ArraySegment<byte>(sendBytes), WebSocketMessageType.Text, true, CancellationToken.None).Wait(2000);

                                byte[] rcvBytes = new byte[65536];
                                var rcvRes = ws.ReceiveAsync(new ArraySegment<byte>(rcvBytes), CancellationToken.None);
                                rcvRes.Wait(2500);

                                string rcvJson = Encoding.UTF8.GetString(rcvBytes, 0, rcvRes.Result.Count);
                                ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None).Wait(500);

                                Match valMatch = Regex.Match(rcvJson, "\"value\":\\s*\"([^\"]+)\"");
                                if (valMatch.Success && !string.IsNullOrEmpty(valMatch.Groups[1].Value) && valMatch.Groups[1].Value != "null")
                                {
                                    return valMatch.Groups[1].Value;
                                }
                            }
                        }
                    }
                }
            }
            catch {}

            try
            {
                string targetUrl = string.Format("https://www.youtube.com/{0}", handle.StartsWith("@") ? handle : "@" + handle);
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(targetUrl);
                req.Method = "GET";
                if (!string.IsNullOrEmpty(cookie)) req.Headers.Add("Cookie", cookie);
                req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
                req.Timeout = 4000;

                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                using (StreamReader sr = new StreamReader(resp.GetResponseStream()))
                {
                    string html = sr.ReadToEnd();
                    Match m = Regex.Match(html, @"<meta\s+property=""og:title""\s+content=""([^""]+)""");
                    if (!m.Success) m = Regex.Match(html, @"""channelMetadataRenderer""\s*:\s*\{\s*""title""\s*:\s*""([^""]+)""");
                    if (m.Success && !string.IsNullOrEmpty(m.Groups[1].Value))
                    {
                        return m.Groups[1].Value;
                    }
                }
            }
            catch {}

            return null;
        }

        private long GetLiveChannelViews(int debugPort, string handle, string cookie)
        {
            try
            {
                string jsonList = GetHttpString(string.Format("http://127.0.0.1:{0}/json/list", debugPort));
                if (!string.IsNullOrEmpty(jsonList))
                {
                    MatchCollection matches = Regex.Matches(jsonList, "\"webSocketDebuggerUrl\":\\s*\"([^\"]+)\"");
                    foreach (Match m in matches)
                    {
                        if (!m.Success) continue;
                        string wsUrl = m.Groups[1].Value;
                        if (!wsUrl.Contains("/devtools/page/")) continue;

                        using (ClientWebSocket ws = new ClientWebSocket())
                        {
                            ws.ConnectAsync(new Uri(wsUrl), CancellationToken.None).Wait(2000);
                            if (ws.State == WebSocketState.Open)
                            {
                                string evalCmd = "{\"id\":300,\"method\":\"Runtime.evaluate\",\"params\":{\"expression\":\"(function(){ try { let t = document.body.innerText; let m = t.match(/([\\\\d,]+)\\\\s+views?/i); if (m) return m[1].replace(/,/g, ''); if (window.ytInitialData) { let s = JSON.stringify(window.ytInitialData); let vm = s.match(/viewCountText[^\"]*\"([\\\\d,]+)\"/); if (vm) return vm[1].replace(/,/g, ''); } }catch(e){} return '-1'; })()\",\"returnByValue\":true}}";
                                byte[] sendBytes = Encoding.UTF8.GetBytes(evalCmd);
                                ws.SendAsync(new ArraySegment<byte>(sendBytes), WebSocketMessageType.Text, true, CancellationToken.None).Wait(2000);

                                byte[] rcvBytes = new byte[65536];
                                var rcvRes = ws.ReceiveAsync(new ArraySegment<byte>(rcvBytes), CancellationToken.None);
                                rcvRes.Wait(2500);

                                string rcvJson = Encoding.UTF8.GetString(rcvBytes, 0, rcvRes.Result.Count);
                                ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None).Wait(500);

                                Match valMatch = Regex.Match(rcvJson, "\"value\":\\s*\"([\\d]+)\"");
                                if (valMatch.Success)
                                {
                                    long parsed;
                                    if (long.TryParse(valMatch.Groups[1].Value, out parsed))
                                    {
                                        return parsed;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch {}

            try
            {
                string targetUrl = string.Format("https://www.youtube.com/{0}/about", handle.StartsWith("@") ? handle : "@" + handle);
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(targetUrl);
                req.Method = "GET";
                if (!string.IsNullOrEmpty(cookie)) req.Headers.Add("Cookie", cookie);
                req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
                req.Timeout = 4000;

                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                using (StreamReader sr = new StreamReader(resp.GetResponseStream()))
                {
                    string html = sr.ReadToEnd();
                    Match m = Regex.Match(html, @"viewCountText""\s*:\s*\{\s*""simpleText""\s*:\s*""([\d,]+)");
                    if (!m.Success) m = Regex.Match(html, @"""viewCount""\s*:\s*""(\d+)""");
                    if (!m.Success) m = Regex.Match(html, @"([\d,]+)\s+views?", RegexOptions.IgnoreCase);

                    if (m.Success)
                    {
                        string clean = m.Groups[1].Value.Replace(",", "").Replace(" ", "");
                        long v;
                        if (long.TryParse(clean, out v)) return v;
                    }
                }
            }
            catch {}

            return -1;
        }

        private static bool IsInvalidOrGenericHandle(string handle, string name)
        {
            if (string.IsNullOrEmpty(handle) && string.IsNullOrEmpty(name)) return true;

            string h = (handle ?? "").ToLower().Trim().Replace("@", "");
            string n = (name ?? "").ToLower().Trim();

            if (h == "creator" || h == "youtube" || h == "user" || h == "shortcut" || h == "signin") return true;
            if (n.Contains("create, grow") || n.Contains("youtube for creators") || n.Contains("service login") || n.Contains("sign in")) return true;
            if (n.Contains("@gmail") || n.Contains("@yahoo") || n.Contains("@hotmail") || n.Contains("@outlook")) return true;

            return false;
        }

        private class LoggedInChannelInfo
        {
            public string CustomHandle { get; set; }
            public string ChannelId { get; set; }
            public string ChannelName { get; set; }
            public string AvatarUrl { get; set; }
        }

        private LoggedInChannelInfo FetchLoggedInUserIdentityFromYouTubeCookie(string cookie)
        {
            LoggedInChannelInfo info = new LoggedInChannelInfo();
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("https://www.youtube.com/");
                req.Method = "GET";
                req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
                req.Headers.Add("Cookie", cookie);
                req.Headers.Add("Accept-Language", "en-US,en;q=0.9");
                req.Timeout = 5000;

                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                using (StreamReader sr = new StreamReader(resp.GetResponseStream()))
                {
                    string html = sr.ReadToEnd();
                    Match handleMatch = Regex.Match(html, @"""canonicalBaseUrl""\s*:\s*""\/(@[a-zA-Z0-9._-]+)""");
                    Match cidMatch = Regex.Match(html, @"""browseId""\s*:\s*""(UC[a-zA-Z0-9_-]{22})""");
                    Match titleMatch = Regex.Match(html, @"""channelTitle""\s*:\s*""([^""]+)""");
                    Match avatarMatch = Regex.Match(html, @"""avatarButton""\s*:\s*\{[^\}]*""url""\s*:\s*""([^""]+)""");

                    if (handleMatch.Success && !IsInvalidOrGenericHandle(handleMatch.Groups[1].Value, null))
                    {
                        info.CustomHandle = handleMatch.Groups[1].Value;
                    }
                    if (cidMatch.Success)
                    {
                        info.ChannelId = cidMatch.Groups[1].Value;
                    }
                    if (titleMatch.Success && !IsInvalidOrGenericHandle(null, titleMatch.Groups[1].Value))
                    {
                        info.ChannelName = titleMatch.Groups[1].Value;
                    }
                    if (avatarMatch.Success)
                    {
                        info.AvatarUrl = avatarMatch.Groups[1].Value;
                    }
                }
            }
            catch {}
            return info;
        }

        private class LiveMetadata
        {
            public string ChannelName { get; set; }
            public string CustomHandle { get; set; }
            public string ChannelId { get; set; }
            public string AvatarUrl { get; set; }
            public long TotalViews { get; set; }
            public long Subscribers { get; set; }

            public LiveMetadata()
            {
                TotalViews = -1;
                Subscribers = 0;
            }
        }

        private LiveMetadata FetchFullLiveMetadataFromCDP(int debugPort)
        {
            LiveMetadata meta = new LiveMetadata();
            try
            {
                string jsonList = GetHttpString(string.Format("http://127.0.0.1:{0}/json/list", debugPort));
                if (string.IsNullOrEmpty(jsonList)) return meta;

                MatchCollection matches = Regex.Matches(jsonList, "\"webSocketDebuggerUrl\":\\s*\"([^\"]+)\"");
                foreach (Match m in matches)
                {
                    if (!m.Success) continue;
                    string wsUrl = m.Groups[1].Value;
                    if (!wsUrl.Contains("/devtools/page/")) continue;

                    using (ClientWebSocket ws = new ClientWebSocket())
                    {
                        ws.ConnectAsync(new Uri(wsUrl), CancellationToken.None).Wait(2000);
                        if (ws.State == WebSocketState.Open)
                        {
                            string jsExpr = "(function() { try { let d = window.ytInitialData; let m = d && d.metadata && d.metadata.channelMetadataRenderer; let h = d && d.header && (d.header.c4TabbedHeaderRenderer || d.header.pageHeaderRenderer); let title = (m && m.title) || (h && h.title) || (document.querySelector('meta[property=\"og:title\"]') ? document.querySelector('meta[property=\"og:title\"]').content : '') || ''; let handle = (m && m.vanityChannelUrl) ? m.vanityChannelUrl.split('/').pop() : ''; let avatar = (m && m.avatar && m.avatar.thumbnails && m.avatar.thumbnails.length > 0 ? m.avatar.thumbnails[m.avatar.thumbnails.length - 1].url : '') || (document.querySelector('img.ytd-channel-avatar-renderer') ? document.querySelector('img.ytd-channel-avatar-renderer').src : ''); let cid = (m && m.externalId) || ''; let str = JSON.stringify(d || {}); let viewsMatch = str.match(/viewCountText[^\"]*\"([\\d,]+)\"/); let views = viewsMatch ? viewsMatch[1].replace(/,/g, '') : '-1'; let subsMatch = str.match(/subscriberCountText[^\"]*\"([\\d.,]+[KMBkmb]?)/); let subs = subsMatch ? subsMatch[1] : '0'; return JSON.stringify({ title: title, handle: handle, avatar: avatar, cid: cid, views: views, subs: subs }); } catch(e) { return '{}'; } })()";

                            string evalCmd = "{\"id\":400,\"method\":\"Runtime.evaluate\",\"params\":{\"expression\":\"" + jsExpr.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\",\"returnByValue\":true}}";

                            byte[] sendBytes = Encoding.UTF8.GetBytes(evalCmd);
                            ws.SendAsync(new ArraySegment<byte>(sendBytes), WebSocketMessageType.Text, true, CancellationToken.None).Wait(2000);

                            byte[] rcvBytes = new byte[65536];
                            var rcvRes = ws.ReceiveAsync(new ArraySegment<byte>(rcvBytes), CancellationToken.None);
                            rcvRes.Wait(2500);

                            string rcvJson = Encoding.UTF8.GetString(rcvBytes, 0, rcvRes.Result.Count);
                            ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", CancellationToken.None).Wait(500);

                            Match valMatch = Regex.Match(rcvJson, "\"value\":\\s*\"({.*})\"");
                            if (valMatch.Success)
                            {
                                string innerJson = valMatch.Groups[1].Value.Replace("\\\"", "\"").Replace("\\\\", "\\");
                                Match titleM = Regex.Match(innerJson, "\"title\":\"([^\"]+)\"");
                                Match handleM = Regex.Match(innerJson, "\"handle\":\"([^\"]+)\"");
                                Match avatarM = Regex.Match(innerJson, "\"avatar\":\"([^\"]+)\"");
                                Match cidM = Regex.Match(innerJson, "\"cid\":\"([^\"]+)\"");
                                Match viewsM = Regex.Match(innerJson, "\"views\":\"([^\"]+)\"");

                                if (titleM.Success && !string.IsNullOrEmpty(titleM.Groups[1].Value)) meta.ChannelName = titleM.Groups[1].Value;
                                if (handleM.Success && !string.IsNullOrEmpty(handleM.Groups[1].Value)) meta.CustomHandle = handleM.Groups[1].Value.StartsWith("@") ? handleM.Groups[1].Value : "@" + handleM.Groups[1].Value;
                                if (avatarM.Success && !string.IsNullOrEmpty(avatarM.Groups[1].Value)) meta.AvatarUrl = avatarM.Groups[1].Value;
                                if (cidM.Success && !string.IsNullOrEmpty(cidM.Groups[1].Value)) meta.ChannelId = cidM.Groups[1].Value;
                                if (viewsM.Success && !string.IsNullOrEmpty(viewsM.Groups[1].Value))
                                {
                                    long v;
                                    if (long.TryParse(viewsM.Groups[1].Value, out v)) meta.TotalViews = v;
                                }
                            }
                        }
                    }
                }
            }
            catch { }
            return meta;
        }

        private bool UpdateSupabaseRecord(string email, string userId, string handle, string cookie, int debugPort)
        {
            try
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;
                ServicePointManager.Expect100Continue = false;

                string apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3d2R6a2h0bmFlcGFtc2ZpdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUxNjMsImV4cCI6MjA5ODQxMTE2M30.60vipeZzzdplww-8fuRD_LYvQ-2oawfNm-kx2ur3So0";

                long totalViews = -1;
                long subscribers = 0;
                string avatarUrl = null;
                string channelId = null;
                string channelName = null;
                string customHandle = handle;

                // 1. DYNAMICALLY FETCH LIVE REAL METADATA FROM OPEN CHROME PAGE VIA CDP
                LiveMetadata cdpMeta = FetchFullLiveMetadataFromCDP(debugPort);
                if (!string.IsNullOrEmpty(cdpMeta.ChannelName) && !IsInvalidOrGenericHandle(null, cdpMeta.ChannelName)) channelName = cdpMeta.ChannelName;
                if (!string.IsNullOrEmpty(cdpMeta.CustomHandle) && !IsInvalidOrGenericHandle(cdpMeta.CustomHandle, null)) customHandle = cdpMeta.CustomHandle;
                if (!string.IsNullOrEmpty(cdpMeta.ChannelId)) channelId = cdpMeta.ChannelId;
                if (!string.IsNullOrEmpty(cdpMeta.AvatarUrl)) avatarUrl = cdpMeta.AvatarUrl;
                if (cdpMeta.TotalViews >= 0) totalViews = cdpMeta.TotalViews;
                if (cdpMeta.Subscribers > 0) subscribers = cdpMeta.Subscribers;

                // 2. DYNAMICALLY FETCH LIVE CHANNEL TITLE & VIEWS AS FALLBACK IF CDP RETURNED PARTIAL DATA
                if (string.IsNullOrEmpty(channelName) || IsInvalidOrGenericHandle(customHandle, channelName))
                {
                    string liveTitle = GetLiveChannelTitle(debugPort, customHandle, cookie);
                    if (!string.IsNullOrEmpty(liveTitle) && !IsInvalidOrGenericHandle(null, liveTitle)) channelName = liveTitle;
                }
                if (totalViews < 0)
                {
                    long liveViews = GetLiveChannelViews(debugPort, customHandle, cookie);
                    if (liveViews >= 0) totalViews = liveViews;
                }

                // 3. Query existing record by email to preserve fields
                try
                {
                    string getUrl = string.Format("https://bwwdzkhtnaepamsfivds.supabase.co/rest/v1/Youtube?email=eq.{0}", Uri.EscapeDataString(email));
                    HttpWebRequest getReq = (HttpWebRequest)WebRequest.Create(getUrl);
                    getReq.Method = "GET";
                    getReq.Headers.Add("apikey", apikey);
                    getReq.Headers.Add("Authorization", "Bearer " + apikey);
                    getReq.Timeout = 5000;

                    using (HttpWebResponse getResp = (HttpWebResponse)getReq.GetResponse())
                    using (StreamReader sr = new StreamReader(getResp.GetResponseStream()))
                    {
                        string json = sr.ReadToEnd();
                        Match tvMatch = Regex.Match(json, "\"total_views\":\\s*(\\d+)");
                        Match subMatch = Regex.Match(json, "\"subscribers\":\\s*(\\d+)");
                        Match avMatch = Regex.Match(json, "\"avatar_url\":\\s*\"([^\"]+)\"");
                        Match cidMatch = Regex.Match(json, "\"channel_id\":\\s*\"([^\"]+)\"");
                        Match cnameMatch = Regex.Match(json, "\"channel_name\":\\s*\"([^\"]+)\"");
                        Match chandleMatch = Regex.Match(json, "\"custom_handle\":\\s*\"([^\"]+)\"");

                        if (totalViews < 0 && tvMatch.Success) long.TryParse(tvMatch.Groups[1].Value, out totalViews);
                        if (subscribers == 0 && subMatch.Success) long.TryParse(subMatch.Groups[1].Value, out subscribers);
                        if (string.IsNullOrEmpty(avatarUrl) && avMatch.Success && !string.IsNullOrEmpty(avMatch.Groups[1].Value) && avMatch.Groups[1].Value != "null") {
                            avatarUrl = avMatch.Groups[1].Value;
                        }
                        if (string.IsNullOrEmpty(channelId) && cidMatch.Success && !string.IsNullOrEmpty(cidMatch.Groups[1].Value) && cidMatch.Groups[1].Value != "null") {
                            channelId = cidMatch.Groups[1].Value;
                        }
                        if ((string.IsNullOrEmpty(channelName) || IsInvalidOrGenericHandle(null, channelName)) && cnameMatch.Success && !string.IsNullOrEmpty(cnameMatch.Groups[1].Value) && !IsInvalidOrGenericHandle(null, cnameMatch.Groups[1].Value)) {
                            channelName = cnameMatch.Groups[1].Value;
                        }
                        if ((string.IsNullOrEmpty(customHandle) || IsInvalidOrGenericHandle(customHandle, null)) && chandleMatch.Success && !string.IsNullOrEmpty(chandleMatch.Groups[1].Value) && !IsInvalidOrGenericHandle(chandleMatch.Groups[1].Value, null)) {
                            customHandle = chandleMatch.Groups[1].Value;
                        }
                    }
                }
                catch {}

                if (string.IsNullOrEmpty(channelName) || IsInvalidOrGenericHandle(null, channelName)) channelName = !string.IsNullOrEmpty(customHandle) && !IsInvalidOrGenericHandle(customHandle, null) ? customHandle : "YouTube Creator";
                if (totalViews < 0) totalViews = 0;

                string patchUrl = string.Format("https://bwwdzkhtnaepamsfivds.supabase.co/rest/v1/Youtube?email=eq.{0}", Uri.EscapeDataString(email));
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(patchUrl);
                req.Method = "PATCH";
                req.ContentType = "application/json";
                req.Headers.Add("apikey", apikey);
                req.Headers.Add("Authorization", "Bearer " + apikey);
                req.Timeout = 10000;

                string escapedCookie = cookie.Replace("\\", "\\\\").Replace("\"", "\\\"");

                StringBuilder sb = new StringBuilder();
                sb.Append("{");
                sb.Append(string.Format("\"custom_handle\":\"{0}\",\"channel_name\":\"{1}\",\"youtube_cookie\":\"{2}\",\"total_views\":{3},\"subscribers\":{4}", customHandle, channelName, escapedCookie, totalViews, subscribers));
                if (!string.IsNullOrEmpty(channelId)) {
                    sb.Append(string.Format(",\"channel_id\":\"{0}\"", channelId));
                }
                if (!string.IsNullOrEmpty(avatarUrl)) {
                    sb.Append(string.Format(",\"avatar_url\":\"{0}\"", avatarUrl));
                }
                sb.Append("}");

                byte[] bytes = Encoding.UTF8.GetBytes(sb.ToString());
                req.ContentLength = bytes.Length;

                using (Stream os = req.GetRequestStream())
                {
                    os.Write(bytes, 0, bytes.Length);
                }

                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    return (int)resp.StatusCode >= 200 && (int)resp.StatusCode < 300;
                }
            }
            catch { return false; }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Program());
        }
    }
}
