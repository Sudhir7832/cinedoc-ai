export interface SarvamVoiceOption {
  id: string;
  label: string;
}

export interface SarvamVoiceGroup {
  label: string;
  voices: SarvamVoiceOption[];
}

export const SARVAM_VOICE_GROUPS: SarvamVoiceGroup[] = [
  {
    label: 'Documentary & narration',
    voices: [
      { id: 'anand_hi_documentary', label: 'Anand · Hindi documentary' },
      { id: 'mahesh_hi_documentary', label: 'Mahesh · Hindi documentary' },
      { id: 'ratan_hi_documentary', label: 'Ratan · Hindi documentary' },
      { id: 'girish_en_documentary', label: 'Girish · English documentary' },
      { id: 'shubh_en_narration', label: 'Shubh · English narration' },
      { id: 'simran_en_narration', label: 'Simran · English narration' },
    ],
  },
  {
    label: 'Kids & stories',
    voices: [
      { id: 'chhavi_hi_kids', label: 'Chhavi · Hindi kids' },
      { id: 'kunal_hi_kids', label: 'Kunal · Hindi kids' },
      { id: 'ritu_hi_kids', label: 'Ritu · Hindi kids' },
      { id: 'nupur_en_kids', label: 'Nupur · English kids' },
      { id: 'aditi_en_stories', label: 'Aditi · English stories' },
      { id: 'shubh_hi_stories_dramatic', label: 'Shubh · Hindi dramatic stories' },
    ],
  },
  {
    label: 'Customer care & empathetic support',
    voices: [
      { id: 'aparna_hi_customer', label: 'Aparna · Hindi customer care' },
      { id: 'aarti_hi_customer', label: 'Aarti · Hindi customer care' },
      { id: 'shubh_hi_customer', label: 'Shubh · Hindi customer care' },
    ],
  },
  {
    label: 'Collections & payment reminders',
    voices: [
      { id: 'simran_hi_recovery', label: 'Simran · Hindi recovery' },
      { id: 'shubh_hi_ecomm', label: 'Shubh · Hindi commerce' },
      { id: 'shubh_hi_customer', label: 'Shubh · Hindi customer care' },
    ],
  },
  {
    label: 'Appointments & receptionist',
    voices: [
      { id: 'aparna_hi_customer', label: 'Aparna · Hindi receptionist' },
      { id: 'shubh_hi_ecomm', label: 'Shubh · Hindi commerce' },
      { id: 'ratan_hi_customer_expressive', label: 'Ratan · Hindi expressive customer' },
    ],
  },
];

export function hasSarvamVoice(voiceId: string): boolean {
  return SARVAM_VOICE_GROUPS.some(group => group.voices.some(voice => voice.id === voiceId));
}
