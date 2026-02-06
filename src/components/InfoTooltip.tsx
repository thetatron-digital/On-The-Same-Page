import { useState, useRef, useEffect } from 'react';
import './InfoTooltip.css';

interface TooltipExample {
  text: string;
  source?: string;
}

interface TooltipOption {
  name: string;
  description: string;
  examples?: string;
}

export interface TooltipContent {
  title?: string;
  examples?: TooltipExample[];
  options?: TooltipOption[];
  description?: string;
}

interface InfoTooltipProps {
  content: TooltipContent;
}

export const InfoTooltip = ({ content }: InfoTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'bottom' | 'top' | 'left' | 'right'>('bottom');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && iconRef.current) {
      const iconRect = iconRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Check if tooltip would go off screen and adjust position
      if (iconRect.bottom + tooltipRect.height + 10 > viewportHeight) {
        if (iconRect.top - tooltipRect.height - 10 > 0) {
          setPosition('top');
        } else if (iconRect.left - tooltipRect.width - 10 > 0) {
          setPosition('left');
        } else {
          setPosition('right');
        }
      } else if (iconRect.left + tooltipRect.width / 2 > viewportWidth) {
        setPosition('left');
      } else if (iconRect.left - tooltipRect.width / 2 < 0) {
        setPosition('right');
      } else {
        setPosition('bottom');
      }
    }
  }, [isVisible]);

  const hasContent = content.examples?.length || content.options?.length || content.description;
  if (!hasContent) return null;

  return (
    <span
      className="info-tooltip-wrapper"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <span className="info-icon" ref={iconRef}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </span>
      {isVisible && (
        <div className={`info-tooltip-popup ${position}`} ref={tooltipRef}>
          {content.title && <div className="tooltip-title">{content.title}</div>}

          {content.description && (
            <div className="tooltip-description">{content.description}</div>
          )}

          {content.examples && content.examples.length > 0 && (
            <div className="tooltip-examples">
              <div className="tooltip-section-title">Examples</div>
              <ul>
                {content.examples.map((example, i) => (
                  <li key={i}>
                    {example.text}
                    {example.source && <span className="example-source"> ({example.source})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.options && content.options.length > 0 && (
            <div className="tooltip-options">
              <div className="tooltip-section-title">Options</div>
              <div className="options-list">
                {content.options.map((option, i) => (
                  <div key={i} className="option-item">
                    <div className="option-name">{option.name}</div>
                    <div className="option-description">{option.description}</div>
                    {option.examples && (
                      <div className="option-examples">Examples: {option.examples}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  );
};

// Tooltip data for all fields
export const TOOLTIP_DATA = {
  // Plot Overview tooltips
  title: {
    examples: [
      { text: 'Hell or High Water' },
      { text: 'Rocky' },
      { text: 'Whiplash' },
    ],
  },
  logline: {
    title: 'Examples',
    examples: [
      { text: 'A divorced father and his ex-con older brother resort to a desperate scheme in order to save their family\'s ranch in West Texas.', source: 'Hell or High Water' },
      { text: 'A small-time Philadelphia boxer gets a supremely rare chance to fight the world heavyweight champion in a bout in which he strives to go the distance for his self-respect.', source: 'Rocky' },
      { text: 'A promising young drummer enrolls at a cut-throat music conservatory where his dreams of greatness are mentored by an instructor who will stop at nothing to realize a student\'s potential.', source: 'Whiplash' },
    ],
  },
  themes: {
    title: 'Examples',
    examples: [
      { text: 'How far should a man go to survive?', source: 'Hell or High Water' },
      { text: 'Are you a loser because people say you are?', source: 'Rocky' },
      { text: 'How far should you go in pursuit of your dreams?', source: 'Whiplash' },
    ],
  },
  storyTypes: {
    title: 'Example',
    examples: [
      { text: 'Road Story - a hero gathers a team to embark on a journey in search of a prize' },
      { text: 'Examples: Star Wars, Back to the Future, The Wizard of Oz' },
    ],
    options: [
      { name: 'Trapped with a Monster', description: 'A treacherous creature hunts sinful characters in a confined space.', examples: 'Jaws, Alien' },
      { name: 'Road Story', description: 'A hero gathers a team to embark on a journey in search of a prize.', examples: 'Star Wars, Back to the Future, The Wizard of Oz, Stand by Me' },
      { name: 'Magic Wish', description: 'The protagonist is granted a magical wish, but this comes with unforeseen consequences.', examples: 'Bruce Almighty, Blank Check' },
      { name: 'Rite of Passage', description: 'Learning how to accept change in the face of adversity.', examples: 'Ordinary People, 10, Days of Wine, Sideways' },
      { name: 'Love or Friend Story', description: 'When an incomplete hero meets their counterpart, they must each grow in order to live in harmony.', examples: 'Rain Man, Dumb and Dumber, The Hangover' },
      { name: 'Detective', description: 'A detective must break the rules in order to uncover a dark secret.', examples: 'The Insider, JFK, Chinatown' },
      { name: 'Institutionalized', description: 'An ingenious hero is forced to join an established order, or destroy it.', examples: 'The Godfather, Do the Right Thing, Sicario, Dr. Strangelove' },
      { name: 'Superhero', description: 'A hero with special powers, opposed by a powerful adversary, and driven by destiny.', examples: 'Gladiator, Batman, Frankenstein' },
    ],
  },
  genres: {
    title: 'Examples',
    examples: [
      { text: 'Western, Heist' },
      { text: 'Drama, Sport' },
      { text: 'Drama' },
    ],
    options: [
      { name: 'Action', description: 'High-energy sequences with physical conflict.' },
      { name: 'Horror', description: 'Stories designed to frighten and unsettle.' },
      { name: 'Western', description: 'Set in the American Old West.' },
      { name: 'Romance', description: 'Focus on romantic relationships.' },
      { name: 'Comedy', description: 'Designed to make audiences laugh.' },
      { name: 'Heist', description: 'Stories centered around elaborate theft.' },
      { name: 'Mystery/Suspense', description: 'Focus on solving puzzles or crimes.' },
      { name: 'Thriller', description: 'Intense suspense and excitement.' },
      { name: 'Sci-Fi', description: 'Speculative fiction with futuristic technology.' },
      { name: 'Fantasy', description: 'Stories with magical or supernatural elements.' },
    ],
  },
  tone: {
    title: 'Examples',
    examples: [
      { text: 'Violent, Tense, High-Energy, Relentless' },
      { text: 'Hopeful, Motivational and Rousing' },
      { text: 'Feverish, Frenzied, and Maniacal' },
    ],
  },
  audience: {
    title: 'Examples',
    examples: [
      { text: 'Adult' },
      { text: 'Family' },
      { text: 'PG-13' },
    ],
  },
  setting: {
    title: 'Examples',
    examples: [
      { text: 'Texas; 2016' },
      { text: 'New York; 1970s' },
      { text: 'New York; 2010s' },
    ],
  },
  bStory: {
    title: 'Examples',
    examples: [
      { text: 'Marcus\' impending retirement' },
      { text: 'Adrian\'s flaws mirror Rocky\'s. They are not losers because people say they are. Love will prevail' },
      { text: 'Andrew\'s relationship with Nicole' },
    ],
  },

  // Character tooltips
  characterName: {
    title: 'Examples',
    examples: [
      { text: 'Ellen Louise Ripley' },
      { text: 'Rocky Balboa' },
      { text: 'King T\'Challa' },
    ],
  },
  role: {
    options: [
      { name: 'Protagonist', description: 'The main character driving the story.' },
      { name: 'Antagonist', description: 'The primary force opposing the protagonist.' },
      { name: 'Opponent', description: 'A secondary force creating obstacles.' },
      { name: 'Mentor', description: 'Guides and teaches the protagonist.' },
      { name: 'Love Interest', description: 'Romantic connection to the protagonist.' },
      { name: 'Ally', description: 'Supports and assists the protagonist.' },
      { name: 'Fake-Ally Opponent', description: 'Appears friendly but secretly works against the protagonist.' },
      { name: 'Fake-Opponent Ally', description: 'Appears hostile but secretly helps the protagonist.' },
      { name: 'Other', description: 'Supporting or minor character.' },
    ],
  },
  characterArc: {
    options: [
      { name: 'Positive Arc', description: 'The character needs the moral lesson, they learn and embrace it and become a better member of society.' },
      { name: 'Flat Arc', description: 'The hero remains virtuous and the villain evil with no transformation, teaching a depraved society to embrace the moral lesson of the story and become better for it.' },
      { name: 'Spiral Arc', description: 'The character needs the moral lesson, but they learn and reject it to spiral into madness, depravity, or death.' },
      { name: 'Corruption Arc', description: 'The character starts out virtuous, but they learn and reject the moral lesson and become a depraved member of society.' },
    ],
  },
  physicalDescription: {
    title: 'Examples',
    examples: [
      { text: '46, Female, Korean, Skater' },
      { text: '30s, Male, Italian-American, Boxer' },
      { text: '18, African-American, Tall, Hipster' },
    ],
  },
  personality: {
    title: 'Examples',
    examples: [
      { text: 'Focused, Calm, No nonsense' },
      { text: 'Dreamer' },
      { text: 'Talented, Driven, Obsessive' },
    ],
  },
  archetypes: {
    title: 'Examples',
    examples: [
      { text: 'Rebel' },
      { text: 'Orphan' },
      { text: 'The Hero' },
    ],
    options: [
      { name: 'Lover', description: 'Wants harmony in everything they do. Can lose their own identity while trying to please others. Afraid of feeling unloved.' },
      { name: 'Magician', description: 'Wants to understand the laws of the universe. Can become manipulative or egotistical. Afraid of unintended consequences.' },
      { name: 'Explorer', description: 'Wants to experience new things and learn. Can become aimless, with no follow-through. Afraid of being forced to conform.' },
      { name: 'Sage', description: 'Wants to understand the world and teach others. Can be indecisive without information. Afraid of being ignorant.' },
      { name: 'Innocent', description: 'Wants to be happy, and always looks for the silver lining. Can be too trusting. Afraid of being punished for doing wrong.' },
      { name: 'Creator', description: 'Wants to create things of enduring value. Can be a perfectionist. Afraid of failing to create anything great.' },
      { name: 'Ruler', description: 'Wants to create a prosperous family or community. Can become authoritarian. Afraid of chaos, or being overthrown.' },
      { name: 'Caregiver', description: 'Wants to help others. Has lots of empathy and compassion - which can be exploited. Afraid of being considered selfish.' },
      { name: 'Orphan', description: 'Wants to belong. Dependable, down to earth, realist. Can be too cynical. Afraid of being left out.' },
      { name: 'Jester', description: 'Wants to be the life of the party. Can be frivolous, and hide emotions under humor. Afraid of being perceived as boring.' },
      { name: 'Classic Villain', description: 'Wants to foil the Hero and Protagonist. No redeeming qualities. Evil for the sake of being evil.' },
      { name: 'Anti-Villain', description: 'Has noble traits and values, but is convinced the ends justifies the means. Wants to achieve goals at any costs.' },
      { name: 'Beast', description: 'Relies on instincts and destructive abilities to achieve their goals. Can\'t be reasoned with or controlled.' },
      { name: 'Authority Figure', description: 'Wants wealth, prestige, or power. Will stop at nothing to get more of what they want. Tyrannical, cruel, ruthless.' },
      { name: 'Bully', description: 'Wants to make life miserable for the Protagonist. Often became a bully as victim of abuse themselves, with insecurity resulting.' },
      { name: 'Fanatic', description: 'Driven by extreme ideology. Can fail to realize the consequences of their actions.' },
      { name: 'Machine', description: 'Technology designed to kill or obstruct the Protagonist. Emotionless, relentless, an almost-unstoppable force.' },
      { name: 'Evil Personified', description: 'Evil incarnate. Can\'t be reasoned with, threatened, or ignored.' },
      { name: 'Mastermind', description: 'Enjoys breaking other people\'s wills. Highly intelligent with a superiority complex. Obsesses over challenging the Protagonist.' },
      { name: 'Henchman', description: 'Wants to carry out orders for their boss. Brawny but lacking in intelligence.' },
      { name: 'Shadow', description: 'Near doppelganger to the Protagonist - sharing the same skills, abilities, and knowledge - but differing in ethics and morals.' },
      { name: 'Corrupted', description: 'Once a paragon of justice, they succumb to fear and desire, and become evil.' },
    ],
  },
  want: {
    title: 'Examples',
    examples: [
      { text: 'To steal money from the bank that\'s stealing his mom\'s house' },
      { text: 'To stand his ground against Apollo Creed' },
      { text: 'To become the greatest jazz drummer in history' },
    ],
  },
  need: {
    title: 'Examples',
    examples: [
      { text: 'To learn that actions have consequences' },
      { text: 'To learn that he can be a champion' },
      { text: 'To learn that there is more to life than being a great musician' },
    ],
  },
  lie: {
    title: 'Examples',
    examples: [
      { text: 'It\'s okay to steal from corrupt banks' },
      { text: 'That nobody will love him and he will never make anything of himself' },
      { text: 'He must focus on his music at the expense of everything else' },
    ],
  },
  ghost: {
    title: 'Examples',
    examples: [
      { text: 'Generational poverty' },
      { text: 'Everybody in his life has told him he was a bum or a loser. He believes it' },
      { text: 'Father was a failure creatively' },
    ],
  },

  // Beat tooltips - Act 1
  prologue: {
    description: 'A beat that sets up Tone, Setting, Scope; and contrasts the Epilogue to illustrate Protagonist growth.',
  },
  protagonistWant: {
    description: 'A beat that clearly defines a Goal the Protagonist wants to achieve during the story.',
  },
  protagonistNeed: {
    description: 'A beat that defines a Moral Lesson essential to the Protagonist\'s growth, that also conflicts with their Goal.',
  },
  protagonistLife: {
    description: 'A beat illustrating the Protagonist\'s daily routines at Home, Work, and Play; and problems they create by violating the Moral Lesson.',
  },
  protagonistPlight: {
    description: 'A beat that describes how the Protagonist\'s Lie is holding them back from achieving their "Want."',
  },
  incitingIncident: {
    description: 'An unexpected event that upsets the Protagonist\'s Status Quo, and propels the story forward.',
  },
  hesitation: {
    description: 'A beat where the Protagonist reacts to the Inciting Incident, either positively or negatively.',
  },
  prepareForGoal: {
    description: 'A beat where the Protagonist plans to restore the Status Quo, in order to achieve their Goal.',
  },
  attemptAtGoal: {
    description: 'A beat where the Protagonist attempts to restore the Status Quo, in order to achieve their Goal.',
  },
  plotPoint1: {
    description: 'A significant event that affects the Protagonist, either internally or externally, and forces them to make a decision.',
  },

  // Beat tooltips - Act 2A
  crossToUnknown: {
    description: 'A beat that illustrates the Protagonist\'s decision to abandon their Status Quo, and embark on a journey to achieve their Goal.',
  },
  bStoryBeat: {
    description: 'A beat that illustrates the Theme through the Protagonist\'s relationship with a Mentor or Love Interest.',
  },
  trialsOfInitiation: {
    description: 'A beat where the Protagonist struggles to achieve their Goal, while meeting new Allies and Antagonists.',
  },
  gainSkills: {
    description: 'A beat where the Protagonist learns skills and/or behaviors associated with the Moral Lesson, from various Allies and/or Antagonists.',
  },
  pinchPoint1: {
    description: 'An event, less dramatic than a Plot Point, that psychologically affects the Protagonist.',
  },
  trials: {
    description: 'A beat where the Protagonist struggles to achieve their Goal, while meeting new Allies and Antagonists.',
  },
  reachInnerSanctum: {
    description: 'A beat that shows the Protagonist and Allies, now experienced and familiar with the Unknown, make new plans to achieve their Goal.',
  },
  midpoint: {
    description: 'A dramatic Wish Fulfillment for the Protagonist, who has not yet learned the Moral Lesson. Stakes are raised, and a deadline for the Goal is introduced. NOTE: This beat can alternatively be a Comeuppance, but either situation should contrast the drama of Pinch Point 2.',
  },

  // Beat tooltips - Act 2B
  internalTension: {
    description: 'A beat illustrating how dissent, doubt, and jealousy create conflict between the Protagonist and their Allies.',
  },
  externalTension: {
    description: 'A beat where the Antagonist regroups, and doubles their effort to obstruct the Protagonist\'s Goal.',
  },
  sacrificeNeedForWant: {
    description: 'A beat illustrating the Protagonist\'s awareness of the Moral Lesson, but committing to their Goal in spite of it.',
  },
  increasingTension: {
    description: 'A beat where the Antagonist obstructs the Protagonist, and/or conflict rises between the Protagonist and their Allies.',
  },
  twist: {
    description: 'An unexpected event that changes the perception of preceding events, or places the main conflict in a different context.',
  },
  completeFailure: {
    description: 'A moment of absolute and seemingly permanent defeat for the Protagonist, in their pursuit of the Goal.',
  },
  admitDefeat: {
    description: 'A beat where the Protagonist admits defeat and exhibits humility.',
  },
  momentOfClarity: {
    description: 'A beat where the Protagonist realizes the importance of the Moral Lesson, and how it relates to their plight.',
  },
  plotPoint3: {
    description: 'A beat where the Protagonist makes the decision to confront the Antagonist.',
  },

  // Beat tooltips - Act 3
  makeAmends: {
    description: 'A beat where the Protagonist pays the price for their mistakes and/or achievements.',
  },
  atoneWithAllies: {
    description: 'A beat where the Protagonist makes amends with their Allies.',
  },
  createFinalPlan: {
    description: 'A beat where the Protagonist and Allies make a Final Plan to achieve their Goal.',
  },
  attemptFinalPlan: {
    description: 'A beat where the Protagonist and Allies attempt to execute their Final Plan.',
  },
  proofOfGrowth: {
    description: 'A beat illustrating how the Protagonist and Allies use the Moral Lesson to fix problems from the daily routines.',
  },
  defeatLieutenants: {
    description: 'A beat illustrating growth for Allies, as they defeat the secondary Antagonists, or sacrifice themselves for the cause.',
  },
  unexpectedTurn: {
    description: 'An unexpected beat in which the Protagonist is led into a trap by the main Antagonist, and forced into confrontation.',
  },
  chooseNeedOrWant: {
    description: 'A beat where the Protagonist reacts to the Unexpected Turn, and must finally accept or refuse the Moral Lesson.',
  },
  executeFinalPlan: {
    description: 'A beat illustrating the Protagonist using the Moral Lesson to defeat the Antagonist; OR, a beat illustrating the Protagonist refusing the Moral Lesson and being defeated by the Antagonist.',
  },
  epilogue: {
    description: 'A beat that contrasts the Prologue to illustrate the growth, or corruption/fall of the Protagonist.',
  },
};

// Helper to get beat tooltip by beat name
export const getBeatTooltip = (beatName: string): TooltipContent => {
  const beatNameMap: Record<string, keyof typeof TOOLTIP_DATA> = {
    'Prologue': 'prologue',
    'Protagonist Want': 'protagonistWant',
    'Protagonist Need': 'protagonistNeed',
    'Protagonist Life': 'protagonistLife',
    'Protagonist Plight': 'protagonistPlight',
    'Inciting Incident': 'incitingIncident',
    'Hesitation': 'hesitation',
    'Prepare for Goal': 'prepareForGoal',
    'Attempt at Goal': 'attemptAtGoal',
    'Plot Point 1': 'plotPoint1',
    'Cross to Unknown': 'crossToUnknown',
    'B-Story': 'bStoryBeat',
    'Trials of Initiation': 'trialsOfInitiation',
    'Gain Skills': 'gainSkills',
    'Pinch Point 1': 'pinchPoint1',
    'Trials': 'trials',
    'Reach Inner Sanctum': 'reachInnerSanctum',
    'Midpoint': 'midpoint',
    'Internal Tension': 'internalTension',
    'External Tension': 'externalTension',
    'Sacrifice Need for Want': 'sacrificeNeedForWant',
    'Increasing Tension': 'increasingTension',
    'Twist': 'twist',
    'Complete Failure': 'completeFailure',
    'Admit Defeat': 'admitDefeat',
    'Moment of Clarity': 'momentOfClarity',
    'Plot Point 3': 'plotPoint3',
    'Make Amends': 'makeAmends',
    'Atone with Allies': 'atoneWithAllies',
    'Create Final Plan': 'createFinalPlan',
    'Attempt Final Plan': 'attemptFinalPlan',
    'Proof of Growth': 'proofOfGrowth',
    'Defeat Lieutenants': 'defeatLieutenants',
    'Unexpected Turn': 'unexpectedTurn',
    'Choose Need or Want': 'chooseNeedOrWant',
    'Execute Final Plan': 'executeFinalPlan',
    'Epilogue': 'epilogue',
  };

  const key = beatNameMap[beatName];
  if (key && TOOLTIP_DATA[key]) {
    return TOOLTIP_DATA[key];
  }
  return {};
};
