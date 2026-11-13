/**
 * Seed content for each built-in category's first instruction version —
 * written once here so a new user doesn't start with an empty rubric and a
 * dead-end 404 the first time they try to run an audit. Any user can still
 * publish their own version afterward; this is just version 1, not a fixed rule.
 */
const DEFAULT_INSTRUCTIONS = {
  'Medical Billing': `Score this call 1-100 on how well the agent handled medical billing.
- Verified the patient's identity and insurance details before discussing any charges.
- Explained charges, codes, and balances in plain language, not jargon.
- Correctly stated copay, deductible, or balance-due amounts.
- Offered a clear next step (payment plan, dispute process, or follow-up) when the patient couldn't pay in full.
- Stayed calm and professional if the patient was frustrated or confused about a bill.
- Never disclosed billing details to anyone other than the verified patient or authorized representative.
List concrete findings for anything missed or done well.`,

  'Sales Support': `Score this call 1-100 on sales effectiveness and professionalism.
- Opened by identifying the caller's need before pitching anything.
- Matched the recommendation to what the customer actually asked for, not the most expensive option.
- Clearly stated price, terms, and any commitment the customer is agreeing to.
- Handled objections by addressing the concern, not dismissing it.
- Asked for the sale or next step directly, without being pushy.
- Avoided false or exaggerated claims about the product/service.
List concrete findings for anything missed or done well.`,

  'Front Desk / Patient Services': `Score this call 1-100 on front-desk/patient-service quality.
- Greeted the caller promptly and professionally.
- Confirmed the right patient/appointment details before making changes.
- Gave accurate information about hours, location, providers, or scheduling.
- Handled any scheduling conflict or cancellation with a clear resolution.
- Showed empathy if the patient was anxious, in pain, or frustrated.
- Confirmed the caller had everything they needed before ending the call.
List concrete findings for anything missed or done well.`,

  'Customer Support / Service': `Score this call 1-100 on customer support quality.
- Acknowledged the customer's issue clearly before jumping to a solution.
- Asked relevant questions to understand the actual problem.
- Gave accurate information or escalated when outside their own knowledge.
- Resolved the issue or gave a clear, concrete next step with a timeframe.
- Stayed patient and professional even if the customer was upset.
- Confirmed the customer was satisfied with the outcome before ending the call.
List concrete findings for anything missed or done well.`,

  'Collections / Payment Follow-up': `Score this call 1-100 on collections/payment follow-up handling.
- Verified the account/debtor's identity before discussing any balance.
- Stated the amount owed and its basis accurately and clearly.
- Offered a reasonable payment arrangement when the person couldn't pay in full.
- Did not use pressure tactics, threats, or misleading statements about consequences.
- Stayed professional and non-confrontational even if the person pushed back.
- Documented or confirmed the agreed-upon outcome (payment date/amount, dispute, etc.) before ending the call.
List concrete findings for anything missed or done well.`,
};

module.exports = { DEFAULT_INSTRUCTIONS };
