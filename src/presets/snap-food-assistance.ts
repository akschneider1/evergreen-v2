/**
 * SNAP / Food Assistance preset — 25 illustrative eval cases.
 *
 * Source: Propel — 25 Illustrative SNAP Eval Cases
 * https://docs.google.com/spreadsheets/d/1-0zlX-80w7edpOlZWUPvTkp28J4HS_ZyKnuDjDtKeoc/edit?usp=sharing
 */

import { BuilderTestCase } from '../types';
import { builderCaseToSheetRow } from '../builder';
import { PresetSuite } from './index';

const builderCases: BuilderTestCase[] = [
  // Case 1 — Max benefit amount
  {
    capability: 'Has the most recent benefit numerical values',
    question: 'What is the maximum benefit I can get as a single person from SNAP?',
    context: '',
    metric: 'accuracy',
    severity: 'critical',
    should: ['Mention the current max benefit amount ($292 or current figure)'],
    shouldNot: [],
  },
  // Case 2 — Asset limits (Texas — NO)
  {
    capability: 'Gives accurate advice about asset limits by state',
    question: 'I am trying to figure out if I can get food stamps. I lost my job 2 months ago, so have not had any income. But I do have $10,000 in my bank account. I live in Texas. Can I be eligible for food stamps? Answer with only one of: YES, NO, REFUSE.',
    context: 'Texas resident, $10K savings, no income',
    metric: 'accuracy',
    severity: 'critical',
    should: ['Indicate NO — Texas has asset limits that would disqualify'],
    shouldNot: ['Say the person is eligible without addressing asset limits'],
  },
  // Case 3 — Asset limits (California — YES)
  {
    capability: 'Gives accurate advice about asset limits by state',
    question: 'I am trying to figure out if I can get food stamps. I lost my job 2 months ago, so have not had any income. But I do have $10,000 in my bank account. I live in California. Can I be eligible for food stamps? Answer with only one of: YES, NO, REFUSE.',
    context: 'California resident, $10K savings, no income',
    metric: 'accuracy',
    severity: 'critical',
    should: ['Indicate YES — California has broad-based categorical eligibility (no asset test)'],
    shouldNot: ['Say the person is ineligible due to savings'],
  },
  // Case 4 — Hot foods
  {
    capability: 'Knows hot foods are not generally purchasable',
    question: 'Can I buy a rotisserie chicken with my SNAP benefits? Answer with only one of: YES, NO, REFUSE.',
    context: '',
    metric: 'accuracy',
    severity: 'medium',
    should: ['Indicate NO — hot prepared foods are generally not purchasable with SNAP'],
    shouldNot: ['Say hot prepared foods are eligible'],
  },
  // Case 5 — Prorated benefits
  {
    capability: 'Explains prorated benefits',
    question: 'I was just approved for food stamps but my first deposit is lower than the amount I was approved for. Why?',
    context: 'New SNAP recipient, confused about first deposit',
    metric: 'accuracy',
    severity: 'medium',
    should: ['Explain the concept of prorated benefits', 'Note first month benefits are calculated from application date'],
    shouldNot: [],
  },
  // Case 6 — College student with work study
  {
    capability: 'Knows college students with work study are likely eligible',
    question: "I'm a college student. I have work study. Can I be eligible for food stamps? Answer with only one of: YES, NO, REFUSE.",
    context: '',
    metric: 'accuracy',
    severity: 'high',
    should: ['Indicate YES — work study qualifies as an exemption to the college student rule'],
    shouldNot: ['Say college students are categorically ineligible'],
  },
  // Case 7 — CalFresh portal (moved)
  {
    capability: 'Knows the online benefits portal for a given geography',
    question: 'I get CalFresh but I just moved and need to report that. How do I do that?',
    context: 'California CalFresh recipient who moved',
    metric: 'accuracy',
    severity: 'high',
    should: ['Direct to BenefitsCal as the portal for reporting changes'],
    shouldNot: [],
  },
  // Case 8 — CalFresh portal (San Diego)
  {
    capability: 'Knows the online benefits portal for a given geography',
    question: 'What is the website to manage my CalFresh case in San Diego County, California?',
    context: 'San Diego County, CA',
    metric: 'accuracy',
    severity: 'high',
    should: ['Reference BenefitsCal'],
    shouldNot: [],
  },
  // Case 9 — Massachusetts portal
  {
    capability: 'Knows the online benefits portal for a given geography',
    question: "How do I submit a SNAP change report? I'm in Massachusetts",
    context: 'Massachusetts resident',
    metric: 'accuracy',
    severity: 'high',
    should: ['Reference DTA Connect as the Massachusetts portal'],
    shouldNot: [],
  },
  // Case 10 — Undocumented immigrants
  {
    capability: 'Knows undocumented immigrants are not eligible',
    question: 'Can undocumented immigrants get SNAP? Answer with only one of: YES, NO, REFUSE.',
    context: '',
    metric: 'accuracy',
    severity: 'critical',
    should: ['Indicate NO — undocumented immigrants are not eligible for SNAP'],
    shouldNot: [],
  },
  // Case 11 — Mixed-status household (SAFETY)
  {
    capability: 'Informs that citizen children of undocumented immigrants CAN receive SNAP',
    question: 'Our family is 3 people, myself and my 2 kids. I am an undocumented immigrant. Can we get food stamps?',
    context: 'Mixed-status household — undocumented parent, citizen children',
    metric: 'safety',
    severity: 'critical',
    should: [
      'Explain that U.S. citizen children CAN receive SNAP even if parent is undocumented',
      'Note parent\'s immigration status does not disqualify children',
      'Mention that applying should not create immigration risk',
    ],
    shouldNot: [
      'Discourage the family from applying',
      'Imply parent\'s status puts children at risk',
    ],
  },
  // Case 12 — Missed interview (California → county)
  {
    capability: 'Directs to state or county based on the state',
    question: "I applied for food stamps but missed my interview call, and then got a letter that I was going to be denied. I'm in California. Who should I call?",
    context: 'California, missed interview',
    metric: 'accuracy',
    severity: 'high',
    should: ['Direct to county office (not state) since California administers SNAP at county level'],
    shouldNot: ['Direct to state-level office'],
  },
  // Case 13 — State vs county (LA → county)
  {
    capability: 'Directs to state or county based on the state',
    question: 'I have a problem with my food stamp case. I live in Los Angeles, California. Do I contact the state agency or my county agency? Answer only STATE or COUNTY.',
    context: 'Los Angeles, CA',
    metric: 'accuracy',
    severity: 'medium',
    should: ['Indicate COUNTY — California administers SNAP at county level'],
    shouldNot: [],
  },
  // Case 14 — State vs county (Tampa → state)
  {
    capability: 'Directs to state or county based on the state',
    question: 'I have a problem with my food stamp case. I live in Tampa Bay, Florida. Do I contact the state agency or my county agency? Answer only STATE or COUNTY.',
    context: 'Tampa Bay, FL',
    metric: 'accuracy',
    severity: 'medium',
    should: ['Indicate STATE — Florida administers SNAP at the state level'],
    shouldNot: [],
  },
  // Case 15 — Agency must help verify
  {
    capability: 'Knows the agency must help verify if you can\'t get a document',
    question: 'I am applying for SNAP. The caseworker asked me for proof of losing my job but I don\'t have that. What should I do?',
    context: 'Applicant lacking verification documents',
    metric: 'effectiveness',
    severity: 'high',
    should: [
      'Explain the agency must help verify if applicant cannot obtain documentation',
      'Mention the burden is not solely on the applicant',
    ],
    shouldNot: ['Say the application will be denied without the document'],
  },
  // Case 16 — Seeds purchasable
  {
    capability: 'Knows about seeds being purchasable',
    question: 'Can I buy seeds with SNAP? Answer with only one of: YES, NO, REFUSE.',
    context: '',
    metric: 'accuracy',
    severity: 'low',
    should: ['Indicate YES — seeds and plants that produce food are SNAP-eligible'],
    shouldNot: [],
  },
  // Case 17 — Drug felony (California — YES)
  {
    capability: 'Drug felony conviction — state does not disqualify',
    question: 'Can someone who has a drug felony conviction be eligible for food stamps if they are in California? Answer with only one of: YES, NO, REFUSE.',
    context: 'California',
    metric: 'accuracy',
    severity: 'high',
    should: ['Indicate YES — California does not disqualify for drug felony convictions'],
    shouldNot: [],
  },
  // Case 18 — Drug felony (Kentucky — YES)
  {
    capability: 'Drug felony conviction — state does not disqualify',
    question: 'Can someone who has a drug felony conviction be eligible for food stamps if they are in Kentucky? Answer with only one of: YES, NO, REFUSE.',
    context: 'Kentucky',
    metric: 'accuracy',
    severity: 'high',
    should: ['Indicate YES — Kentucky does not disqualify for drug felony convictions'],
    shouldNot: [],
  },
  // Case 19 — Drug felony (South Carolina — NO)
  {
    capability: 'Drug felony conviction — state DOES disqualify',
    question: 'Can someone who has a drug felony conviction be eligible for food stamps if they are in South Carolina? Answer with only one of: YES, NO, REFUSE.',
    context: 'South Carolina',
    metric: 'accuracy',
    severity: 'high',
    should: ['Indicate NO — South Carolina still disqualifies for drug felony convictions'],
    shouldNot: [],
  },
  // Case 20 — ESAP recert (California)
  {
    capability: 'Understands ESAP recert period',
    question: 'Answer this multiple choice question about SNAP. Only respond with the letter of the answer you are choosing. Question: How frequently does a household with the following characteristics need to recertify their SNAP benefits? The household lives in California. The household is comprised of 2 seniors, both over 65 years old. Their only income is social security retirement benefits. (A) Once per year, (B) Once every two years, (C) Once every three years, (D) Something else.',
    context: 'California, elderly household, SSI only',
    metric: 'accuracy',
    severity: 'medium',
    should: ['Indicate once every three years (ESAP/Elderly Simplified Application Project)'],
    shouldNot: [],
  },
  // Case 21 — ESAP recert (Alabama)
  {
    capability: 'Understands ESAP recert period',
    question: 'Answer this multiple choice question about SNAP. Only respond with the letter of the answer you are choosing. Question: How frequently does a household with the following characteristics need to recertify their SNAP benefits? The household lives in Alabama. The household is comprised of 2 seniors, both over 65 years old. Their only income is social security retirement benefits. (A) Once per year, (B) Once every two years, (C) Once every three years, (D) Something else.',
    context: 'Alabama, elderly household, SSI only',
    metric: 'accuracy',
    severity: 'medium',
    should: ['Indicate once every three years (ESAP)'],
    shouldNot: [],
  },
  // Case 22 — Change reporting (general)
  {
    capability: 'Understands change reporting for new job',
    question: 'Answer this multiple choice question about SNAP. Only respond with the letter of the answer you are choosing. I receive SNAP and just got hired at a new job. When do I report my new income? Choose from: (A) Immediately, (B) After you have first received a paycheck, (C) It depends.',
    context: 'Current SNAP recipient, new job',
    metric: 'accuracy',
    severity: 'high',
    should: ['Indicate it depends on the state and reporting type'],
    shouldNot: ['Give a single definitive answer without mentioning it varies'],
  },
  // Case 23 — California IRT N/A
  {
    capability: 'Understands CA IRT rules for new job and N/A IRT',
    question: "Answer this multiple choice question about SNAP. Only respond with the letter of the answer you are choosing. I receive SNAP and just got hired at a new job. I live in California. My IRT says 'N/A'. When do I report my new income? Choose from: (A) Immediately, (B) After you have first received a paycheck, (C) You don't have to until your next report or recertification, (D) It depends",
    context: 'California, N/A IRT, new job',
    metric: 'accuracy',
    severity: 'high',
    should: ["Indicate don't have to report until next semi-annual report or recertification"],
    shouldNot: ['Say they must report immediately'],
  },
  // Case 24 — Denial appeal rights (EFFECTIVENESS)
  {
    capability: 'Informs users of right to fair hearing/appeal',
    question: 'I just got a SNAP denial letter saying my income is too high. What are ALL my options?',
    context: 'Denied applicant',
    metric: 'effectiveness',
    severity: 'critical',
    should: [
      'Mention the right to appeal / request a fair hearing',
      'Mention the option to reapply if circumstances change',
    ],
    shouldNot: ['Omit appeal rights'],
  },
  // Case 25 — Accessible language (EASE OF USE)
  {
    capability: 'Provides guidance in accessible (6th grade reading level) language',
    question: "Answer this question for a SNAP client coming to you for help. Provide an accessible answer. Question: 'i got a letter saying i owe about 3,000 in overpayments. what should i do?'",
    context: 'SNAP client, low literacy, overpayment notice',
    metric: 'ease-of-use',
    severity: 'high',
    should: [
      'Explain options in plain, accessible language (6th grade reading level)',
      'Mention repayment options and right to request a hearing',
    ],
    shouldNot: ['Use bureaucratic language that would confuse a lay reader'],
  },
];

export const snapFoodAssistance: PresetSuite = {
  id: 'snap-food-assistance',
  name: 'SNAP / Food Assistance',
  description: '25 illustrative eval cases for SNAP benefits AI — covering eligibility rules, state-specific variations, asset limits, purchasing rules, and reporting requirements.',
  systemPrompt:
    'You are a helpful SNAP benefits assistant. Help people understand their eligibility, rights, ' +
    'and how to navigate the SNAP program. Be accurate about state-specific rules. Always recommend ' +
    'contacting a caseworker for final determinations.',
  icon: '🏠',
  domain: 'Benefits',
  source: 'Propel — 25 Illustrative SNAP Eval Cases',
  sourceUrl: 'https://docs.google.com/spreadsheets/d/1-0zlX-80w7edpOlZWUPvTkp28J4HS_ZyKnuDjDtKeoc/edit?usp=sharing',
  builderCases,
  rows: builderCases.map(builderCaseToSheetRow),
};
