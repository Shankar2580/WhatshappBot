# 🔱 Shri Mahakaleshwar Temple, Ujjain
## AI-Powered WhatsApp Booking & Biometric Turnstile Access System
### Executive Stakeholder & Technical Architecture Document

---

## 📌 Executive Summary

The **Shri Mahakaleshwar Temple WhatsApp Booking & Biometric Turnstile System** is an enterprise-grade, end-to-end digital pass and access management solution. It empowers devotees worldwide to effortlessly book Aarti and Darshan passes via WhatsApp while ensuring strict crowd control, security, and instantaneous contactless entry at temple gates using **FacePe AI Face Recognition** and automated turnstile hardware.

To deliver both **maximum convenience for frequent pilgrims** and **frictionless access for first-time visitors**, the platform introduces a modern **2-Way Booking Architecture**:

1. **🌟 Way 1: 1-Time Devotee Profile Registration ("Register Once, Book in 10 Seconds")**  
   Devotees complete identity verification (Aadhaar / Passport) and biometric face capture once. All future Aarti and Darshan bookings are completed in **10 seconds** with 1-click checkout.
2. **⚡ Way 2: Quick Direct Guest Booking**  
   Ad-hoc visitors can book immediate on-the-spot passes through a streamlined conversational flow with the option to save their profile for future visits.

---

## 🎯 Key Objectives & Business Benefits

| Stakeholder | Key Value Delivered |
| :--- | :--- |
| **Temple Trust & Administration** | • Elimination of ticket black-marketing and fake passes via facial biometric binding.<br>• Real-time crowd capacity management per time slot.<br>• High-throughput gate clearance (sub-500ms turnstile opening). |
| **Devotees & Pilgrims** | • 10-second booking experience for regular devotees without repetitive KYC/photo uploads.<br>• Official digital PDF passes with QR codes delivered directly to WhatsApp.<br>• Hands-free, contactless entry at temple gates without physical ticket queues. |
| **Security & Gate Operations** | • Guaranteed 1-person-1-pass entry enforcement through automated biometric turnstiles.<br>• Offline & local network fail-safe relay gate controls.<br>• Complete audit trail of bookings and entries. |

---

## 🔄 The 2-Way Devotee Journey & Conversational Flows

```mermaid
graph TD
    Start[Devotee sends 'Hi' / 'Book' to WhatsApp Bot] --> CheckProfile{Is Devotee Profile Registered?}
    
    %% Track 1: Registered Devotee
    CheckProfile -->|YES - Registered Profile Found| RegMenu[🔱 Welcome Back Menu<br><i>'Namaste Rajesh Ji!'</i>]
    RegMenu --> B1[⚡ 1-Click Fast Book for Myself]
    RegMenu --> B2[👥 Fast Book for Family/Group]
    RegMenu --> B3[👤 View My Active Passes / Profile]
    
    B1 --> SelectAarti1[1. Select Aarti / Darshan]
    SelectAarti1 --> SelectDate1[2. Select Date]
    SelectDate1 --> SelectSlot1[3. Select Time Slot]
    SelectSlot1 --> FastConfirm[⚡ 1-Click Pay & Pass Dispatch<br><i>(KYC & Face reused automatically)</i>]
    
    B2 --> GroupCount[Enter Number of Guests & Names]
    GroupCount --> FastConfirm
    
    %% Track 2: New / Unregistered Devotee
    CheckProfile -->|NO - New Devotee| WelcomeMenu[Welcome Menu]
    WelcomeMenu --> Opt1[📝 1-Time Devotee Registration<br><i>Lifetime Fast Booking</i>]
    WelcomeMenu --> Opt2[🎟️ Quick Direct Booking<br><i>Instant Single Pass</i>]
    
    Opt1 --> RegLang[Select Language]
    RegLang --> RegKYC[Aadhaar OTP / Passport Verification]
    RegKYC --> RegSelfie[Upload Solo Devotee Selfie]
    RegSelfie --> RegVector[Vector Extracted & Saved to fpv_whatsapp_faces]
    RegVector --> RegSuccess[🎉 Profile Activated!<br><i>Ready for 10-second bookings</i>]
    
    Opt2 --> GuestFlow[Standard 1-Time Booking Flow]
    GuestFlow --> GuestPay[Payment & PDF Pass Issued]
    GuestPay --> PromptSave[💡 Save Profile for 1-Click Booking Next Time?]
```

---

## 📱 Detailed Chat Walkthroughs

### Journey A: 1-Time Devotee Profile Setup (First-Time Registration)

```
[Devotee]: Hi
[Bot]: 🔱 Shri Mahakaleshwar Temple, Ujjain 🔱
       Welcome to the official booking assistant. How would you like to proceed?
       [ 📝 1-Time Devotee Registration ]  [ 🎟️ Quick Direct Booking ]

(Devotee clicks: 📝 1-Time Devotee Registration)
[Bot]: Please select your preferred language:
       [ English ]  [ हिंदी ]

(Devotee clicks: English)
[Bot]: Let's verify your identity for temple security.
       Please select your ID type:
       [ 🇮🇳 Indian Aadhaar (Instant OTP) ]  [ 🌍 International Passport ]

(Devotee enters Aadhaar -> receives OTP -> enters OTP)
[Bot]: ✅ Aadhaar verified successfully!
       Name: Rajesh Sharma
       DOB: 15-08-1988
       Gender: Male

[Bot]: 📸 Please take a clear, solo selfie of yourself and send it here.
       This will be used for hands-free entry at the temple turnstile gates.

(Devotee uploads selfie)
[Bot]: ⏳ Processing facial biometric features...
       ✅ Biometric profile successfully enrolled!

[Bot]: 🎉 Registration Complete, Rajesh Ji!
       Your FacePe Devotee ID is active. From now on, you can book any Aarti or Darshan in 10 seconds without re-uploading ID or photos!
       [ ⚡ Book Aarti Now ]  [ 🏠 Main Menu ]
```

---

### Journey B: 10-Second Repeat Booking (For Registered Devotees)

```
[Devotee]: Hi
[Bot]: 🔱 Namaste Rajesh Sharma Ji!
       Welcome back to Shri Mahakaleshwar Temple, Ujjain.
       Your verified profile is active. What would you like to book today?
       [ ⚡ 1-Click Fast Book (Myself) ]  [ 👥 Book for Family/Group ]  [ 👤 View My Passes ]

(Devotee clicks: ⚡ 1-Click Fast Book (Myself))
[Bot]: Select Aarti or Darshan:
       [ 1. Bhasma Aarti ]
       [ 2. Shighra Darshan ]
       [ 3. Sandhya Aarti ]
       [ 4. Shayan Aarti ]

(Devotee picks: Bhasma Aarti)
[Bot]: Please select your Darshan Date:
       (Interactive 30-Day Calendar / Date List)

(Devotee picks: 24/09/2026)
[Bot]: Available Time Slots:
       [ 04:00 AM - 06:00 AM (12 slots left) ]
       [ 06:00 AM - 08:00 AM (45 slots left) ]

(Devotee picks: 04:00 AM - 06:00 AM)
[Bot]: 📋 Booking Summary:
       • Devotee: Rajesh Sharma (Verified)
       • Service: Bhasma Aarti
       • Date: 24/09/2026
       • Slot: 04:00 AM - 06:00 AM
       • Gate: Gate No. 4 (Turnstile Access)
       • Amount: ₹200

       [ 💳 Proceed to Secure Payment ]

(Devotee completes 1-click Razorpay payment)
[Bot]: 🔱 Har Har Mahadev!
       Your booking is officially confirmed. Your Official Booking PDF Pass is attached below.
       📄 MAHAKAL-24092026-1120.pdf
       🙏 Please preserve this PDF pass for entry at Shri Mahakaleshwar Temple gate.
```

---

## 🏗️ Technical Architecture & Infrastructure

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              DEVOTEE CHANNELS                                 │
│          Devotee on WhatsApp             Devotee at Temple Turnstile          │
└───────────────────────┬───────────────────────────────────────┬───────────────┘
                        │                                       │
                        ▼                                       ▼
┌──────────────────────────────────────────┐   ┌────────────────────────────────┐
│         Meta WhatsApp Cloud API          │   │  Turnstile Hardware Terminal   │
│         (Interactive UI & Media)         │   │ (FacePe-Tungstile-With-P2-App) │
└───────────────────────┬──────────────────┘   └────────────────┬───────────────┘
                        │                                       │
                        ▼                                       ▼
┌──────────────────────────────────────────┐   ┌────────────────────────────────┐
│           facepe-whatsapp-bot            │   │  Sub-500ms Facial Identify API │
│       (Node.js / Express Webhook)        │   │  (POST /fo/faces/identify)     │
└───────────┬──────────────────────┬───────┘   └────────────────┬───────────────┘
            │                      │                            │
            ▼                      ▼                            │
┌──────────────────────┐ ┌──────────────────────┐               │
│      KYCBox API      │ │  Razorpay Payment    │               │
│ (Aadhaar / Passport) │ │       Gateway        │               │
└──────────────────────┘ └──────────────────────┘               │
                                   │                            │
                                   ▼                            ▼
                 ┌──────────────────────────────────────────────────────────────┐
                 │                      facepe-opensource                       │
                 │          (InsightFace ArcFace 512-dim AI Engine)             │
                 └──────────────────────────────┬───────────────────────────────┘
                                                │
                                                ▼
                 ┌──────────────────────────────────────────────────────────────┐
                 │                 AWS OpenSearch Vector Database               │
                 │      Index: fpv_whatsapp_faces (Dedicated & Isolated)        │
                 └──────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security, Compliance & Data Isolation

1. **Dedicated OpenSearch Vector Index (`fpv_whatsapp_faces`)**:
   * WhatsApp devotee face embeddings are isolated in a dedicated OpenSearch vector index.
   * Commercial FacePe User App and Merchant Kiosk data remain 100% separate in `fpv_faces`.
2. **KYC & Anti-Scalping Protection**:
   * Devotees are authenticated via Government-verified Aadhaar OTP or Passport OCR.
   * Eliminates bots, bulk scalpers, and black-market ticket hoarding.
3. **Turnstile Hardware Anti-Passback**:
   * Gate barriers unlock only once per confirmed booking for the verified devotee face.
4. **Data Privacy & Ephemeral Storage**:
   * Temporary photo buffers are wiped from disk immediately after vector generation and PDF composition.

---

## 📊 Summary Comparison: Old Flow vs New 2-Way Flow

| Metric | Previous Single Flow | New 2-Way Flow (Track 1 / Track 2) |
| :--- | :--- | :--- |
| **Repeat Devotee Booking Time** | 2.5 – 3.5 minutes | **10 – 15 seconds** ⚡ |
| **Repetitive KYC Required?** | Yes, every single booking | **No, 1-time setup only** ✅ |
| **Repetitive Selfie Upload?** | Yes, every single booking | **No, pre-enrolled vector used** ✅ |
| **Direct Guest Booking Available?** | Yes | **Yes, fully supported** ✅ |
| **Gate Passage Speed** | Contactless AI Face Recognition | **Contactless AI Face Recognition (Sub-500ms)** |
| **Data Isolation** | Shared database index | **Dedicated `fpv_whatsapp_faces` Index** 🛡️ |

---

*Document prepared for Mahakaleshwar Temple Board, Technical Leadership & Key Stakeholders.*
