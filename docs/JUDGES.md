# Judges' walkthrough script

About three minutes: the 7-slide deck, with a live demo between slides 3 and 4.

**Roles:**

- **Presenter:** drives the slides and the dashboard, and does all the talking.
- **Scammer:** a teammate with their own phone.
- **Dolores:** the phone ending 7664.
- **Susan:** the phone ending 0632.

Grey lines are stage directions, and everything else is spoken.

## Before you start

- Check that the server and the ngrok tunnel are up and Cartesia has credits.
- Set up the dashboard:
    - Open it with the passcode already set.
    - Click **Reset demo**.
    - Leave it on the **Scam Shield** view.
- Get the phones ready: charged, ringers on, volume at maximum, speakerphone ready.
- Keep the backup video (`second-signature-demo.mp4`) open in another window.

## Slide 1: Cover (0:00)

Hi, we're [names]. Second Signature is a fraud desk for small credit unions. It warns members while a scam call is
happening, and it never moves a dollar without a person signing off.

## Slide 2: $7.7 billion (0:10)

Last year, Americans over 60 reported 7.7 billion dollars lost to fraud to the FBI, which is 59 percent more than the
year before. Most of it comes from scripts people have heard before, like a fake IRS agent, fake tech support or a debt
collector who doesn't exist.

## Slide 3: The hardest case (0:25)

We built the demo around the hardest week, which is the one right after a member dies. Harold Whitcomb died in March. A
scammer is about to call his widow Dolores asking for 8,900 dollars in gift cards, and at the same time the US Treasury
is reclaiming 4,180 dollars of Social Security that kept arriving after he died. Only the Treasury is owed anything, so
let's see whether the system can tell the two apart.

> Switch to the dashboard (Scam Shield view).

## Live demo, part 1: Scam Shield (0:45)

> Scammer dials (415) …3852. Dolores answers on speaker, presses any key at the trial message and says "Hello?". Only
> then does the scammer read:

**Scammer:** "Mrs. Whitcomb, this is collections about Harold's debts. As his widow you're responsible, you have to pay
today in gift cards, and don't tell your bank."

> Stay quiet while the chime and the whisper play on Dolores's phone. Then point at the Scam Shield view.

Dolores just heard a warning from her credit union, and the caller heard nothing. Cartesia transcribed only his side of
the call, and Claude Haiku flagged the script before he finished the sentence. For the next day, any gift card, wire or
crypto purchase on her account waits for a person.

> Dolores hangs up.

## Live demo, part 2: Estate desk (1:10)

> Click **Estate desk**, then **Run estate desk**, then **Harold**.

Now the claim that's real. The agent read the death certificate, a rep's note, the credit file and the account history.

> Point at the Reclamation table.

1,045 dollars of the claim had already gone back to the Treasury, so the agent protests that part, and it returns the
535 dollars still in the account.

> Click **Why?**

Claude Opus explains every line with a rule or a source, and our code checks each citation and amount before it's
shown.

> Click **Sign as controller**, then confirm.

The agent only drafts these entries, so the controller is the one who signs them.

## Live demo, part 3: The call (1:35)

> Click **Call Dolores**. Dolores answers on speaker and presses a key.

Now it calls Dolores to explain all of this in plain words.

> The bot asks one question. Dolores picks the "Former Lender" whose number is between 1 and 6. The bot explains and
> offers Susan. Dolores says "Yes, please." Susan answers, presses a key and says "Hi, Mom."

It checked her identity with a question from her credit file, told her she owes the scammer nothing, and handed her to
her daughter so she isn't dealing with this alone.

> Switch back to the slides.

## Slide 4: Estate accounting (2:15)

Besides the scam warning, what you just saw was the agent doing estate accounting that most small credit unions can't
staff. It checks the Treasury's claim against the federal rules, drafts the journal entries and the reply, and leaves
the signature to the controller. In our test estates it caught all five planted errors.

## Slide 5: How it's built (2:30)

The demo ran on Claude Haiku 5.5 for the calls and the scam check, because it answers fast enough to keep a phone
conversation natural. Cartesia Ink streams the transcript, which is what lets us catch a scam mid-sentence, and Cartesia
Sonic is the calm voice she hears, slowed down a little for older listeners. Claude Opus 5.5 writes the estate
explanations while the arithmetic stays in our own code, and underneath it all are Twilio, Pipecat, Convex and Vercel.

## Slide 6: Safety (2:50)

The agent can't move money on its own, because the permission checks live in our server code. We tested it with 500
red-team calls in which Claude played scammers and impostors, and none of the 300 attack calls got money released or
got through verification. Scam Shield also caught all 140 scam calls without a single false alarm.

## Slide 7: Close (3:05)

Second Signature warns members during scam calls and never moves a dollar without a person signing off. Thank you, and
we'd love to take your questions.

## If you're running long

- On slide 2, drop the second sentence.
- In the estate desk, skip **Why?** and go straight to **Sign as controller**.
- On slide 5, drop the last clause about Twilio, Pipecat, Convex and Vercel.

## If something breaks

Every trial-account call opens with Twilio's message and needs a key press, so allow a few extra seconds before
deciding a call has failed.

| What fails | What to do |
|---|---|
| The whisper never plays | Say "here's the same call recorded earlier" and play the video from 0:08 to 0:27. |
| Call Dolores doesn't ring | The estate desk still shows everything; play the video from 1:01 to 1:37 for the call. |
| Why? errors | A template explanation from the same numbers appears instead; keep going. |
| No verification question | The credit-file service is down, so the bot ends the call without discussing the account. That is the designed failure, so say so. |

## Likely questions

**"Is it listening to every call she gets?"**

Only calls to the protected line she opted into. Callers hear a notice, the audio is analysed in memory, and the only
thing kept is the sentence that triggered the warning.

**"What if she really does want the gift card?"**

The hold lasts a day at most, and a person at the credit union can release it. A short delay on a gift card costs far
less than a payment to a scammer that never comes back.

**"Why would a credit union trust an AI with its books?"**

It only drafts. Every number comes from our code, every sentence of Claude's explanation has to cite a rule or a source
before anyone sees it, and nothing posts until the controller signs.
