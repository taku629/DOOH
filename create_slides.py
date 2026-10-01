from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

prs = Presentation()

# Title Slide
slide = prs.slides.add_slide(prs.slide_layouts[0])
title = slide.shapes.title
subtitle = slide.placeholders[1]
title.text = "新宿DOOH - System Architecture"
subtitle.text = "Realtime Database, Display Sync, and Transaction logic\nTechnical Deep Dive"

# Slide 1: System Overview
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
body = slide.placeholders[1]
title.text = "Overall System Architecture"
tf = body.text_frame
tf.text = "The DOOH project is composed of three main layers:"
p = tf.add_paragraph()
p.text = "1. Participant Flow (Smartphones)"
p.level = 1
p = tf.add_paragraph()
p.text = "Served via Firebase Hosting. Users scan QR codes, load the web app, and swipe to participate."
p.level = 2
p = tf.add_paragraph()
p.text = "2. Backend (Firebase Realtime Database)"
p.level = 1
p = tf.add_paragraph()
p.text = "Acts as the central source of truth, handling concurrent transactions, state synchronization, and validation rules."
p.level = 2
p = tf.add_paragraph()
p.text = "3. DOOH Display (demo.html etc.)"
p.level = 1
p = tf.add_paragraph()
p.text = "Large web-based visual client that subscribes to Firebase events in real-time to trigger ink splats and visual changes."
p.level = 2

# Slide 2: Real-time Communication Flow
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
body = slide.placeholders[1]
title.text = "Real-time Communication Flow"
tf = body.text_frame
tf.text = "How a smartphone swipe appears on the DOOH display in milliseconds:"
p = tf.add_paragraph()
p.text = "1. Swipe Action:"
p.level = 1
p = tf.add_paragraph()
p.text = "publishSwipeComplete() triggers a transaction via Firebase SDK."
p.level = 2
p = tf.add_paragraph()
p.text = "2. Transaction:"
p.level = 1
p = tf.add_paragraph()
p.text = "The payload (name, visitorId, etc.) is pushed. The global participantCount is exactly incremented by +1."
p.level = 2
p = tf.add_paragraph()
p.text = "3. Firebase Validation:"
p.level = 1
p = tf.add_paragraph()
p.text = "database.rules.json verifies the payload format and ensures exact +1 count logic."
p.level = 2
p = tf.add_paragraph()
p.text = "4. Listener Trigger:"
p.level = 1
p = tf.add_paragraph()
p.text = "demo.html uses subscribeToParticipantCount() and onChildAdded listener to receive the event."
p.level = 2

# Slide 3: Duplicate Prevention & Transaction Logic
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
body = slide.placeholders[1]
title.text = "Duplicate Prevention & Transaction Logic"
tf = body.text_frame
tf.text = "Ensuring fair participation and preventing rapid spamming:"
p = tf.add_paragraph()
p.text = "1. Once-per-day Limitation:"
p.level = 1
p = tf.add_paragraph()
p.text = "localStorage holds a visit record. The server (dailyParticipants node) enforces one write per visitorId per day."
p.level = 2
p = tf.add_paragraph()
p.text = "2. Transaction Builder (buildParticipationTransactionValue):"
p.level = 1
p = tf.add_paragraph()
p.text = "Atomically groups updates to: total participantCount, swipes log, dailyParticipants, and participantHistory (streak/return logic)."
p.level = 2
p = tf.add_paragraph()
p.text = "3. Security Rules & Retry Logic:"
p.level = 1
p = tf.add_paragraph()
p.text = "Ensures write consistency. Concurrent writes cause the transaction to retry up to 3 times before returning a 'busy' failure to the client."
p.level = 2

# Slide 4: DOOH Visual Logic (18-Person Challenge)
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
body = slide.placeholders[1]
title.text = "DOOH Visual Logic (18-Person Challenge)"
tf = body.text_frame
tf.text = "The interactive challenge system pacing:"
p = tf.add_paragraph()
p.text = "1. VISUAL_CHANGE_INTERVAL = 18:"
p.level = 1
p = tf.add_paragraph()
p.text = "Every 18 successful swipes form a complete visual 'challenge' segment."
p.level = 2
p = tf.add_paragraph()
p.text = "2. Two-Stage Ink Splats (Core & Final):"
p.level = 1
p = tf.add_paragraph()
p.text = "9 distinct ink splats × 2 beats each = 18 steps. First beat reveals the 'core' (smaller/eroded), second beat replaces it with the full splat."
p.level = 2
p = tf.add_paragraph()
p.text = "3. Celebration Trigger (startCelebration):"
p.level = 1
p = tf.add_paragraph()
p.text = "At 18 swipes, a final layer is shown, and the visual resets for the next 18-person loop."
p.level = 2

# Slide 5: Multi-Channel & Specialized Flows
slide = prs.slides.add_slide(prs.slide_layouts[1])
title = slide.shapes.title
body = slide.placeholders[1]
title.text = "Multi-Channel & Specialized Flows"
tf = body.text_frame
tf.text = "The system handles multiple environments and physical deployments:"
p = tf.add_paragraph()
p.text = "1. Channels (Firebase Nodes):"
p.level = 1
p = tf.add_paragraph()
p.text = "participation, participationV2, participationMorning, participationResearch, participationYouTube"
p.level = 2
p = tf.add_paragraph()
p.text = "2. Participant UIs (Experiences):"
p.level = 1
p = tf.add_paragraph()
p.text = "participant-flow.js (Standard)"
p.level = 2
p = tf.add_paragraph()
p.text = "participant-flow-women-orange.js (Sparkle experience)"
p.level = 2
p = tf.add_paragraph()
p.text = "YouTube Live Mode: allows repeated participations with a 10s cooldown instead of the strict 1-day lock."
p.level = 2

prs.save('/home/takumu/DOOH/dooh_technical_architecture.pptx')
