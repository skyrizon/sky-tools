const en = {
  meta: {
    homeTitle: "Sky Tools — Free Online QR Code, Image & PDF Tools",
    homeDescription:
      "Free online tools that run in your browser: QR code generator, image converter, PDF to JPG and more. No sign-up, no uploads — your files stay on your device.",
    siteDescription: "Free, private web tools that run in your browser.",
    ogTagline: "QR codes, image and PDF conversion, and more — right in your browser.",
    ogFreeTool: "Free tool",
  },

  nav: {
    tools: "Tools",
    community: "Community",
    coffee: "Buy me a coffee",
    coffeeAria: "Support Sky Tools on Ko-fi",
    switchLabel: "ไทย",
    switchAria: "อ่านหน้านี้เป็นภาษาไทย",
  },

  footer: {
    prompt: "Found a bug or have an idea?",
    sendFeedback: "Send feedback",
    joinDiscord: "Join Discord",
    about: "About",
    privacy: "Privacy",
    terms: "Terms",
    tagline: "Free tools that run in your browser. Nothing you use them on is uploaded.",
  },

  home: {
    h1: "Free tools, no sign-up required.",
    intro: "A growing collection of small, focused web tools that run right in your browser.",
    aboutTitle: "About Sky Tools",
    aboutBody: [
      "Sky Tools is a small collection of single-purpose web tools that run entirely in your browser — a QR code generator, an image and PDF converter, and more added over time. No file or piece of data you type into a tool is ever uploaded to a server. That's a deliberate choice: most everyday conversions and generations don't need a round trip to the cloud, so they don't get one here.",
      "Every tool is free, with no sign-up and no account — just open a tool and use it.",
    ],
  },

  tools: {
    "qr-generator": {
      name: "QR Code Generator",
      description: "Turn text, links, or WiFi credentials into a QR code — with an optional logo.",
      seoTitle: "Free QR Code Generator — WiFi, Links & Logo",
      metaDescription:
        "Create QR codes for links, text, and WiFi in seconds. Add a logo, pick colors, download PNG or SVG. Free, no sign-up, and nothing leaves your browser.",
    },
    "image-converter": {
      name: "Image Converter",
      description:
        "Convert images between JPG, PNG, and WebP, or turn a PDF into images — right in your browser.",
      seoTitle: "Image Converter — JPG, PNG, WebP & PDF to Image",
      metaDescription:
        "Convert JPG, PNG, and WebP images or turn every PDF page into an image. Batch convert and download as ZIP. Free, private, and nothing is uploaded.",
    },
  },

  common: {
    faqTitle: "Frequently asked questions",
    relatedTitle: "More free tools",
    breadcrumbHome: "Sky Tools",
  },

  support: {
    title: "Your file is ready. Hope it helped!",
    before: "Sky Tools stays free for everyone. If you'd like to cheer us on, a coffee on",
    link: "Ko-fi",
    after: "means a lot. Totally optional.",
    dismiss: "Dismiss",
  },

  community: {
    metaTitle: "Community",
    metaDescription:
      "Report a bug or suggest a new tool for Sky Tools. Every message is read and shapes what gets built next.",
    h1: "Community",
    intro:
      "Found a bug or have an idea for a tool? Tell us here. Every message is read, and what you send shapes what gets built next.",
    ogTitle: "Help shape Sky Tools.",
    ogSubtitle: "Report a problem or suggest an idea. Every message is read.",
    discordTitle: "Discord",
    discordBody: "Chat with other users, get help with a tool, and hear about new tools first.",
    discordCta: "Join the server",
    formTitle: "Report a problem or suggest an idea",
    formHint: "For bugs, say what you did, what you expected, and what happened instead.",
    form: {
      type: "Type",
      types: { bug: "Report a problem", idea: "Suggest an idea", other: "Something else" },
      tool: "Tool",
      general: "General / whole site",
      email: "Email",
      emailHint: "(optional, for follow-up)",
      title: "Title",
      titlePlaceholderBug: "PDF conversion fails on large files",
      titlePlaceholderIdea: "Add a PDF merge tool",
      details: "Details",
      send: "Send feedback",
      sending: "Sending…",
      thanks: "Thanks, we got it.",
      thanksBody: "If you left an email, we may reach out with questions or when it's fixed.",
      sendAnother: "Send another",
      errors: {
        type: "Please choose a feedback type.",
        tool: "Please pick a tool from the list.",
        title: "Please add a title (up to 120 characters).",
        message: "Please add a few details (10 to 4000 characters).",
        email: "Please enter a valid email address.",
        links: "Please include no more than 3 links.",
        rateLimited: "You've sent a lot of feedback in a short time. Please try again in a few minutes.",
        failed: "We couldn't send your feedback right now. Please try again later.",
      },
    },
  },

  qr: {
    intro: "Text, links, or WiFi — generated instantly in your browser.",
    howTitle: "How this QR code generator works",
    howBody: [
      "Pick a type — plain text, a link, or WiFi credentials — fill in the fields, and press Generate. Nothing is sent to a server: the code, the color choices, and even the optional logo are drawn entirely in your browser using the canvas. That also means it works offline once the page has loaded, and your data (like a WiFi password) never leaves your device.",
      "Error correction controls how much of the code can be damaged, covered, or obscured (by a logo, for instance) before it stops scanning reliably. Higher levels make the code slightly denser but more forgiving — the generator raises it automatically when you add a logo or switch to the dotted style, so scans stay reliable without you having to think about it.",
    ],
    faq: [
      {
        q: "Do I need an account to generate a QR code?",
        a: "No. There are no accounts on Sky Tools — generating, previewing, and downloading a QR code as PNG or SVG all work straight away.",
      },
      {
        q: "Will my WiFi password be visible in the QR code?",
        a: "Yes — WiFi QR codes encode the network name, password, and encryption type directly, which is how a phone camera can join the network without anyone typing the password. Only share the code with people you'd trust with the password itself.",
      },
      {
        q: "Can I add a logo to the center of the code?",
        a: "Yes, under “Logo (optional).” The generator automatically increases error correction to keep the code scannable once part of it is covered by the logo.",
      },
      {
        q: "What's the difference between PNG and SVG downloads?",
        a: "PNG is a fixed-resolution image, good for most uses (print, messaging apps, documents). SVG is vector-based and stays sharp at any size, which is better if you plan to resize the code significantly or edit it in design software.",
      },
    ],
    ui: {
      typeText: "Text / URL",
      typeWifi: "WiFi",
      textLabel: "Text or URL",
      ssid: "Network name (SSID)",
      password: "Password",
      encryption: "Encryption",
      encryptionNone: "None",
      hidden: "Hidden network",
      size: "Size ({size}px)",
      errorCorrection: "Error correction",
      levels: { L: "Low (7%)", M: "Medium (15%)", Q: "Quartile (25%)", H: "High (30%)" },
      raisedForLogo: "Raised automatically — a logo needs more error correction to stay scannable.",
      raisedForDots: "Raised automatically — the dot style needs more error correction to stay scannable.",
      foreground: "Foreground color",
      background: "Background color",
      dotStyle: "Dot style",
      dotSquare: "Square",
      dotDots: "Dots",
      eyeColor: "Eye color",
      logo: "Logo (optional)",
      generate: "Generate QR code",
      working: "Working…",
      placeholder: "Your generated QR code will appear here.",
      downloadPng: "Download PNG",
      downloadSvg: "Download SVG",
      errors: {
        logoNotImage: "Logo must be an image file.",
        logoTooBig: "Logo image must be under 2MB.",
        logoUnreadable: "Could not read that image file.",
        wifiSsid: "Please enter the WiFi network name (SSID).",
        empty: "Please enter some text or a URL to encode.",
        tooLong: "Input is too long (maximum 2000 characters).",
        generic: "Could not generate that QR code.",
      },
    },
  },

  converter: {
    intro:
      "Convert images between JPG, PNG, and WebP, or turn a PDF into one image per page — entirely in your browser. Nothing is uploaded.",
    howTitle: "How this converter works",
    howBody: [
      "Every conversion happens locally, using your browser's built-in image engine — no file is ever uploaded to a server. For images, that means a JPG, PNG, or WebP is decoded and re-encoded directly in memory; for a PDF, each page is rendered onto a canvas at high resolution and then exported as its own image. Because nothing leaves your device, this also works with sensitive documents you wouldn't want to upload elsewhere.",
      "JPG doesn't support transparency, so converting a PNG or PDF page with a transparent background to JPG fills it with white first — that's expected, not a bug. WebP usually gives the smallest file size at a given quality, which is why it's the default.",
    ],
    faq: [
      {
        q: "Is my file uploaded anywhere?",
        a: "No. The whole conversion — including reading a PDF's pages — runs in your browser using JavaScript and the Canvas API. Nothing is sent over the network.",
      },
      {
        q: "Which format should I pick?",
        a: "WebP for the smallest file size at good quality (most modern apps and browsers support it). JPG for maximum compatibility with older software. PNG when you need transparency or lossless quality, e.g. for logos or screenshots.",
      },
      {
        q: "Can I convert a multi-page PDF?",
        a: "Yes — each page becomes its own separate image, listed individually with its own download button, plus a “Download all as ZIP” option that bundles the whole set into a single .zip file.",
      },
      {
        q: "Why did my PNG get bigger after converting to JPG?",
        a: "JPG compression is tuned for photos with smooth color gradients; flat-color or text-heavy images (like screenshots or logos) can sometimes compress worse than PNG's lossless format. Try WebP or PNG instead if that happens.",
      },
    ],
    ui: {
      dropTitle: "Drop images or PDFs here, or click to choose files",
      dropHint: "JPG, PNG, WebP, PDF, or other browser-readable images",
      convertTo: "Convert to",
      quality: "Quality ({quality}%)",
      download: "Download",
      remove: "Remove",
      converting: "converting…",
      pageName: "{file} — page {page}",
      downloadAll: "Download all ({count})",
      downloadAllZip: "Download all as ZIP ({count})",
      preparingZip: "Preparing ZIP…",
      largePdf:
        "“{file}” has {pages} pages. Converting them all can take a while and use a lot of memory — remove pages you don't need.",
      pdfUnreadable: "Could not read “{file}” as a PDF.",
      convertFailed: "Conversion failed.",
    },
  },

  about: {
    title: "About Sky Tools",
    metaDescription:
      "Sky Tools is a collection of free, private web tools. Everything runs in your browser — no sign-up, no uploads.",
    sections: [
      {
        heading: "What Sky Tools is",
        body: [
          "Sky Tools is a growing set of small, single-purpose web tools: a QR code generator, an image and PDF converter, and more on the way. Each one does one job and tries to do it quickly, without getting in your way.",
        ],
      },
      {
        heading: "Private by design",
        body: [
          "Every tool runs in your browser. The images, PDFs, and text you use with a tool are processed on your own device and are never uploaded to our servers. That keeps things fast, works for sensitive documents, and means there's nothing of yours for us to store or lose.",
        ],
      },
      {
        heading: "Free, with no account",
        body: [
          "There's nothing to sign up for. Sky Tools is kept running by the ads you see on the site and by optional tips on Ko-fi — donating never unlocks anything, and every tool stays free for everyone.",
        ],
      },
      {
        heading: "Get in touch",
        body: [
          "Found a bug or want a new tool? Use the feedback form on the Community page — every message is read.",
        ],
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    metaDescription:
      "How Sky Tools handles your data: tools run in your browser and files are never uploaded. Details on ads, analytics, feedback, and cookies.",
    updated: "Last updated: 25 September 2026",
    sections: [
      {
        heading: "The short version",
        body: [
          "Sky Tools has no accounts and no database of users. Files and text you use with our tools are processed in your browser and never uploaded. We use privacy-friendly analytics, and the site shows ads from Google AdSense, which may use cookies.",
        ],
      },
      {
        heading: "Files and text you use with a tool",
        body: [
          "Conversions, QR code generation, and every other tool run entirely on your device using your browser. The content you work with is not sent to us or to anyone else.",
        ],
      },
      {
        heading: "Feedback you send",
        body: [
          "When you submit the form on the Community page, we receive the type, tool, title, details, and — only if you enter it — your email address. This is delivered to a private channel on our Discord server, so Discord's privacy policy also applies to it. We use it only to respond to you and improve Sky Tools. To limit spam, your IP address is held briefly in server memory to count submissions; it is not stored.",
        ],
      },
      {
        heading: "Analytics",
        body: [
          "We use Vercel Web Analytics and Speed Insights to see which pages are visited and how fast they load. They don't use cookies and report aggregated data rather than tracking individuals across sites.",
        ],
      },
      {
        heading: "Advertising and cookies",
        body: [
          "Sky Tools shows ads served by Google AdSense. Google and its partners may use cookies or similar identifiers to show ads, including ads based on your previous visits to this and other websites, and to measure their performance. You can learn how Google uses this information at policies.google.com/technologies/partner-sites and manage ad personalisation at myadcenter.google.com.",
        ],
      },
      {
        heading: "Ko-fi",
        body: [
          "The “Support me” button and Ko-fi links load content from ko-fi.com. If you choose to leave a tip, the payment is handled by Ko-fi and its payment providers under their own privacy policies; we never see your card details.",
        ],
      },
      {
        heading: "Hosting",
        body: [
          "The site is hosted on Vercel, which keeps standard server logs (such as IP address and browser type) for security and reliability.",
        ],
      },
      {
        heading: "Your choices and contact",
        body: [
          "You can block or delete cookies in your browser settings; the tools keep working without them. If you have a question about your data, or want feedback you sent to be deleted, contact us through the form on the Community page.",
        ],
      },
      {
        heading: "Changes",
        body: [
          "If this policy changes, we'll update the date at the top of this page.",
        ],
      },
    ],
  },

  terms: {
    title: "Terms of Use",
    metaDescription: "The terms for using Sky Tools' free online tools.",
    updated: "Last updated: 25 September 2026",
    sections: [
      {
        heading: "Using Sky Tools",
        body: [
          "Sky Tools is free to use for personal and commercial purposes. By using the site, you agree to these terms.",
        ],
      },
      {
        heading: "Your content",
        body: [
          "Files and text you use with a tool stay yours; we don't receive or claim them. You're responsible for having the right to use that content, and for what you create with it — for example, where a QR code you generate points to.",
        ],
      },
      {
        heading: "Acceptable use",
        body: [
          "Don't use Sky Tools for anything illegal, to create content that deceives or harms others, or to disrupt the site — including sending automated or abusive feedback.",
        ],
      },
      {
        heading: "No warranty",
        body: [
          "The tools are provided “as is”. We work to keep them accurate and reliable, but we can't guarantee they are error-free or always available. Keep your own copy of anything important, and check results before relying on them.",
        ],
      },
      {
        heading: "Limitation of liability",
        body: [
          "To the extent the law allows, Sky Tools is not liable for any loss or damage arising from using, or being unable to use, the site or its tools.",
        ],
      },
      {
        heading: "Changes",
        body: [
          "We may change the tools or these terms at any time. If the terms change, we'll update the date at the top of this page.",
        ],
      },
    ],
  },

  notFound: {
    title: "Page not found",
    body: "The page you're looking for doesn't exist or has moved.",
    home: "Browse all tools",
  },
};

export default en;
export type Dictionary = typeof en;
