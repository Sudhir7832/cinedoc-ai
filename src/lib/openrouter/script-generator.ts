import { OpenRouterClient } from './client';
import { ContentStyle, KidsFormat, SceneItem, VideoAspectRatio, VideoDurationMinutes } from '../types';

const DOCUMENTARY_VISUAL_STYLE = 'cinematic documentary photograph, dramatic natural lighting, photorealistic, highly detailed, 8k';
const KIDS_VISUAL_STYLES: Record<KidsFormat, string> = {
  educational: 'colorful children\'s educational storybook illustration, clear visual concepts, friendly guides, rounded shapes, bright balanced palette, playful curiosity, clean composition',
  entertainment: 'high-energy children\'s animated story illustration, funny expressive characters, playful action, bold candy colors, whimsical props, joyful cinematic composition',
  adventure: 'vibrant children\'s fantasy adventure illustration, brave friendly heroes, imaginative landscapes, exciting but safe action, dynamic lighting, colorful cinematic composition',
  bedtime: 'gentle children\'s bedtime storybook illustration, cozy friendly characters, soft pastel colors, warm moonlight, dreamy clouds and stars, calm comforting composition',
  rhyme: 'bright nursery rhyme animation, dancing friendly characters, musical shapes, rhythmic movement, bold cheerful colors, playful stage lighting',
};

function getVisualStyle(contentStyle: ContentStyle, kidsFormat: KidsFormat = 'entertainment', aspectRatio: VideoAspectRatio = '16:9'): string {
  const base = contentStyle === 'kids' ? KIDS_VISUAL_STYLES[kidsFormat] : DOCUMENTARY_VISUAL_STYLE;
  const composition = aspectRatio === '9:16' ? 'vertical 9:16 portrait composition, mobile-first framing' : 'widescreen 16:9 composition';
  return `${base}, ${composition}, age-appropriate and non-frightening, no text, no captions, no watermark`;
}

function getKidsDirection(format: KidsFormat): string {
  const directions: Record<KidsFormat, string> = {
    educational: 'Teach one clear idea through curiosity, simple explanations, memorable examples, and friendly visual demonstrations.',
    entertainment: 'Prioritize comedy, imagination, playful surprises, lovable characters, and a satisfying fun story. A lesson is optional and must never feel forced.',
    adventure: 'Create a safe, exciting quest with teamwork, discovery, imaginative obstacles, and a cheerful resolution. Avoid realistic peril or violence.',
    bedtime: 'Create a slow, cozy, reassuring story with gentle repetition, soft wonder, emotional safety, and a peaceful ending suitable before sleep.',
    rhyme: 'Write catchy rhyming lyrics with a repeated chorus, simple rhythm, playful repetition, and singable lines. Use Hindi rhyme when language is Hindi and English rhyme when language is English.',
  };
  return directions[format];
}

interface GeneratedScene {
  title?: string;
  narration?: string;
  imagePrompt?: string;
  subtitleText?: string;
  approxDurationSeconds?: number;
}

interface GeneratedScript {
  summary?: string;
  scenes?: GeneratedScene[];
}

export function detectLanguage(text: string): 'Hindi' | 'English' {
  if (!text) return 'English';
  // Devanagari Unicode range: \u0900-\u097F
  const hindiMatches = text.match(/[\u0900-\u097F]/g) || [];
  const latinMatches = text.match(/[a-zA-Z]/g) || [];

  if (hindiMatches.length > 0 && hindiMatches.length >= Math.max(1, latinMatches.length * 0.15)) {
    return 'Hindi';
  }
  return 'English';
}

export class ScriptGenerator {
  public static async generateDocumentaryScript(params: {
    topic: string;
    customScript?: string;
    durationMinutes: VideoDurationMinutes;
    language?: string;
    contentStyle?: ContentStyle;
    kidsFormat?: KidsFormat;
    aspectRatio?: VideoAspectRatio;
  }): Promise<{ summary: string; scenes: SceneItem[]; detectedLanguage: 'Hindi' | 'English' }> {
    const { topic, customScript, durationMinutes, contentStyle = 'documentary', kidsFormat = 'entertainment', aspectRatio = '16:9' } = params;
    
    // Auto-detect language from customScript or topic
    const detectedLanguage = params.language === 'Hindi' 
      ? 'Hindi' 
      : detectLanguage(`${customScript || ''} ${topic || ''}`);
    const language = params.language || detectedLanguage;

    const targetSceneCount = durationMinutes * 10;
    const sceneDurationSec = 6;

    // If user provided their own custom script, parse and chunk it into scenes!
    if (customScript && customScript.trim().length > 20) {
      console.log(`[ScriptGenerator] Parsing user custom script (${customScript.length} chars, language: ${language})...`);
      const parsedScenes = this.parseCustomScript({
        customScript: customScript.trim(),
        topic,
        durationMinutes,
        language,
        contentStyle,
        kidsFormat,
        aspectRatio,
      });
      return {
        summary: `${contentStyle === 'kids' ? `Kids ${kidsFormat} story` : 'Documentary'} based on user custom script: ${topic}`,
        scenes: parsedScenes,
        detectedLanguage,
      };
    }

    const isKids = contentStyle === 'kids';
    const creativeRole = isKids
      ? `You are an expert children's ${kidsFormat} storyteller and animation director creating engaging, age-appropriate stories for ages 6-12.`
      : 'You are an elite, award-winning cinematic documentary director and scriptwriter.';
    const audienceRules = isKids
      ? `Use simple, lively language for ages 6-12. ${getKidsDirection(kidsFormat)} Keep every scene safe, non-violent, and non-frightening. Never include graphic danger, horror, weapons, or distressing imagery.`
      : `Use authoritative, factual, cinematic documentary narration with a compelling narrative arc.`;
    const visualStyle = getVisualStyle(contentStyle, kidsFormat, aspectRatio);

    const prompt = `${creativeRole}
Create a ${isKids ? 'fun educational kids video' : 'gripping cinematic documentary'} on the topic: "${topic}".

STRICT CONSTRAINTS:
1. The total duration must be ${durationMinutes} minute(s).
2. You MUST produce EXACTLY ${targetSceneCount} distinct sequential scenes.
3. Language for narration and subtitles MUST be: ${language}. (If Hindi, write in fluent Devanagari Hindi script).
4. Each scene corresponds to roughly ${sceneDurationSec} seconds of video (around 12-18 spoken words of narration per scene).
5. ${audienceRules}
6. Every imagePrompt must be in English and follow this exact art direction: "${visualStyle}".

You must respond with valid JSON matching this exact schema:
{
  "summary": "A 1-2 sentence compelling premise of the documentary",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Short title of this scene",
      "narration": "Captivating spoken narration in ${language} (around 12-18 words).",
      "imagePrompt": "Detailed cinematic prompt in English for AI image generator.",
      "approxDurationSeconds": ${sceneDurationSec},
      "subtitleText": "Concise subtitle matching the narration."
    }
  ]
}

DO NOT wrap with markdown code fences if possible, or use standard \`\`\`json. Every scene from 1 to ${targetSceneCount} MUST be included without omission.`;

    const systemMessage = `You are a professional ${isKids ? `children's ${kidsFormat} story` : 'documentary'} generation system. Output strictly valid JSON. Generate exactly ${targetSceneCount} scenes in ${language}. Maintain the requested ${contentStyle} audience and visual style in every scene.`;

    let responseContent = '';
    const config = await (await import('../config')).getConfig();

    try {
      const response = await OpenRouterClient.generateChatCompletion({
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        responseFormat: { type: 'json_object' },
      });
      responseContent = response.content;
    } catch (apiErr: unknown) {
      const apiMessage = apiErr instanceof Error ? apiErr.message : 'Unknown provider error';
      if (config.testMode || apiMessage.includes('402') || apiMessage.includes('429')) {
        console.warn('[ScriptGenerator] OpenRouter unavailable/insufficient credits. Using Free Testing Script Engine:', apiMessage);
        return {
          ...this.generateProceduralScript({ topic, durationMinutes, language, contentStyle, kidsFormat, aspectRatio }),
          detectedLanguage,
        };
      }
      throw apiErr;
    }

    let parsed: GeneratedScript;
    try {
      const raw = responseContent.trim();
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleaned) as GeneratedScript;
    } catch (err: unknown) {
      const parseMessage = err instanceof Error ? err.message : 'Invalid JSON';
      throw new Error(`Failed to parse documentary script JSON from OpenRouter: ${parseMessage}. Raw output snippet: ${responseContent.slice(0, 200)}`);
    }

    if (!parsed || !Array.isArray(parsed.scenes)) {
      throw new Error(`Invalid documentary script structure: "scenes" array is missing.`);
    }

    const validatedScenes: SceneItem[] = [];
    for (let i = 0; i < parsed.scenes.length; i++) {
      const s = parsed.scenes[i];
      const sceneNumber = i + 1;
      const title = s.title?.trim() || `Scene ${sceneNumber}`;
      const narration = s.narration?.trim();
      const imagePrompt = s.imagePrompt?.trim();

      if (!narration) throw new Error(`Scene ${sceneNumber} has empty narration text.`);
      if (!imagePrompt) throw new Error(`Scene ${sceneNumber} has empty image prompt.`);
      const subtitleText = s.subtitleText?.trim() || narration;

      validatedScenes.push({
        sceneNumber,
        title,
        narration,
        imagePrompt: `${imagePrompt}, ${visualStyle}`,
        approxDurationSeconds: s.approxDurationSeconds || sceneDurationSec,
        subtitleText,
        imageStatus: 'pending',
        audioStatus: 'pending',
      });
    }

    if (validatedScenes.length < targetSceneCount) {
      const diff = targetSceneCount - validatedScenes.length;
      const last = validatedScenes[validatedScenes.length - 1];
      for (let k = 0; k < diff; k++) {
        const num = validatedScenes.length + 1;
        validatedScenes.push({
          sceneNumber: num,
          title: language === 'Hindi' ? `निष्कर्ष भाग ${k + 1}` : `Conclusion Part ${k + 1}`,
          narration: isKids
            ? (language === 'Hindi' ? `और हमारी जिज्ञासा हमें अगली मज़ेदार खोज की ओर ले जाती है।` : `And our curiosity leads us toward the next exciting discovery.`)
            : (language === 'Hindi' ? `और इस तरह, इतिहास और विज्ञान की यह खोज आगे भी नए आयाम उजागर करती रहेगी।` : `And so, the search for answers continues, as history and science uncover new dimensions of this enduring mystery.`),
          imagePrompt: `${last.imagePrompt}, ${visualStyle}`,
          approxDurationSeconds: sceneDurationSec,
          subtitleText: language === 'Hindi'
            ? `इतिहास और विज्ञान की यह खोज आगे भी नए आयाम उजागर करती रहेगी।`
            : `The search for answers continues into this enduring mystery.`,
          imageStatus: 'pending',
          audioStatus: 'pending',
        });
      }
    } else if (validatedScenes.length > targetSceneCount) {
      validatedScenes.splice(targetSceneCount);
    }

    return {
      summary: parsed.summary || `A ${durationMinutes}-minute ${isKids ? `kids ${kidsFormat} story` : 'documentary'} about ${topic}.`,
      scenes: validatedScenes,
      detectedLanguage,
    };
  }

  public static parseCustomScript(params: {
    customScript: string;
    topic: string;
    durationMinutes: VideoDurationMinutes;
    language: string;
    contentStyle?: ContentStyle;
    kidsFormat?: KidsFormat;
    aspectRatio?: VideoAspectRatio;
  }): SceneItem[] {
    const { customScript, topic, durationMinutes, language, contentStyle = 'documentary', kidsFormat = 'entertainment', aspectRatio = '16:9' } = params;
    const targetSceneCount = durationMinutes * 10;
    const sceneDurationSec = 6;
    const isHindi = language === 'Hindi';
    const visualStyle = getVisualStyle(contentStyle, kidsFormat, aspectRatio);

    // Step 1: Initial split by sentence terminators
    let segments = customScript
      .split(/(?<=[.!?।\n])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 3);

    // Step 2: If we have fewer segments than targetSceneCount, split longer segments by clauses (,;: or conjunctions)
    if (segments.length < targetSceneCount) {
      const refined: string[] = [];
      for (const seg of segments) {
        if (seg.length > 35 && refined.length + (segments.length - refined.length) < targetSceneCount) {
          const parts = seg.split(/[,;:—]|(?<=\s)(?:और|तथा|एवं|परंतु|लेकिन|and|but|however|while)(?=\s)/i)
            .map(p => p.trim())
            .filter(p => p.length > 5);
          if (parts.length > 1) {
            refined.push(...parts);
            continue;
          }
        }
        refined.push(seg);
      }
      if (refined.length > segments.length) {
        segments = refined;
      }
    }

    const scenes: SceneItem[] = [];

    // Step 3: Map to exactly targetSceneCount scenes
    if (segments.length >= targetSceneCount) {
      const chunkSize = Math.ceil(segments.length / targetSceneCount);
      for (let i = 0; i < targetSceneCount; i++) {
        const start = i * chunkSize;
        const chunk = segments.slice(start, start + chunkSize).join(' ');
        const text = chunk || segments[segments.length - 1];
        const sceneNum = i + 1;
        scenes.push({
          sceneNumber: sceneNum,
          title: isHindi ? `दृश्य ${sceneNum}` : `Scene ${sceneNum}`,
          narration: text,
          imagePrompt: `${contentStyle === 'kids' ? 'Friendly visual story scene' : 'Cinematic scene'} representing ${topic}, scene ${sceneNum}, ${visualStyle}`,
          approxDurationSeconds: sceneDurationSec,
          subtitleText: text.length > 70 ? text.slice(0, 67) + '...' : text,
          imageStatus: 'pending',
          audioStatus: 'pending',
        });
      }
    } else {
      // We have fewer segments than scenes: fill initial, then add concluding transitions
      for (let i = 0; i < targetSceneCount; i++) {
        const sceneNum = i + 1;
        let text = '';
        if (i < segments.length) {
          text = segments[i];
        } else {
          // Graceful concluding narrative in detected language
          const concludingHindi = [
            `यह इतिहास और वर्तमान को जोड़ने वाला एक महत्वपूर्ण पहलू है।`,
            `इस खोज के प्रभाव आज भी शोधकर्ताओं और विचारकों को नई दिशा दिखा रहे हैं।`,
            `आने वाले समय में नई तकनीकें इसके और भी गहरे राज उजागर करेंगी।`,
            `इस प्रकार यह गाथा हमारी समझ और जिज्ञासा को निरंतर समृद्ध करती रहेगी।`,
          ];
          const concludingEnglish = [
            `This remains a pivotal bridge connecting ancient history to the modern world.`,
            `The profound implications of these findings continue to guide contemporary researchers.`,
            `Emerging technologies and future exploration promise to reveal even deeper dimensions.`,
            `And so this enduring story continues to inspire scientific inquiry and human imagination.`,
          ];
          const list = isHindi ? concludingHindi : concludingEnglish;
          text = list[(i - segments.length) % list.length];
        }

        scenes.push({
          sceneNumber: sceneNum,
          title: isHindi ? `दृश्य ${sceneNum}` : `Scene ${sceneNum}`,
          narration: text,
          imagePrompt: `${contentStyle === 'kids' ? 'Friendly visual story scene' : 'Cinematic scene'} of ${topic}, scene ${sceneNum}, ${visualStyle}`,
          approxDurationSeconds: sceneDurationSec,
          subtitleText: text.length > 70 ? text.slice(0, 67) + '...' : text,
          imageStatus: 'pending',
          audioStatus: 'pending',
        });
      }
    }

    return scenes;
  }

  public static generateProceduralScript(params: {
    topic: string;
    durationMinutes: VideoDurationMinutes;
    language?: string;
    contentStyle?: ContentStyle;
    kidsFormat?: KidsFormat;
    aspectRatio?: VideoAspectRatio;
  }): { summary: string; scenes: SceneItem[] } {
    const { topic, durationMinutes, language = 'English', contentStyle = 'documentary', kidsFormat = 'entertainment', aspectRatio = '16:9' } = params;
    const totalScenes = durationMinutes * 10;
    const sceneDurationSec = 6;

    const isHindi = language === 'Hindi';
    const visualStyle = getVisualStyle(contentStyle, kidsFormat, aspectRatio);

    const hindiTemplates = [
      { title: 'प्रस्तावना', narration: `सदियों से, ${topic} ने दुनिया भर के खोजकर्ताओं और वैज्ञानिकों को आकर्षित किया है।` },
      { title: 'ऐतिहासिक आरंभ', narration: `प्राचीन अभिलेखों से पता चलता है कि इस अद्भुत घटना की गूँज सदियों पहले से सुनाई दे रही थी।` },
      { title: 'पहली घटनाएँ', narration: `प्रत्यक्षदर्शियों ने ऐसी अप्रत्याशित घटनाओं की सूचना दी जिन्होंने उस समय के सभी सिद्धांतों को चुनौती दी।` },
      { title: 'रहस्यमयी मोड़', narration: `एक नाटकीय घटना ने अंतरराष्ट्रीय स्तर पर सुर्खियां बटोरीं और इसे हमेशा के लिए अमर कर दिया।` },
      { title: 'वैज्ञानिक पड़ताल', narration: `आधुनिक वैज्ञानिकों ने उन्नत तकनीकों और उपग्रहों के माध्यम से इन रहस्यों की गहराई से पड़ताल की।` },
      { title: 'अनदेखी वास्तविकता', narration: `तथ्यों के परे मानवीय साहस और अज्ञात को समझने की अटूट जिज्ञासा की कहानी सामने आती है।` },
      { title: 'परस्पर विरोधी सिद्धांत', narration: `शोधकर्ताओं के बीच बहस जारी है, जहाँ नए विचार पुरानी धारणाओं को चुनौती दे रहे हैं।` },
      { title: 'हालिया खोजें', narration: `हाल के अध्ययनों ने कई नए सबूत सामने रखे हैं, जिन्होंने इतिहास के इस पन्ने को फिर से खोला है।` },
      { title: 'गहरा प्रभाव', narration: `यहाँ से मिले सबक हमारे विज्ञान और समझ को एक नई दिशा में आगे बढ़ा रहे हैं।` },
      { title: 'अमर गाथा', narration: `जैसे-जैसे खोज आगे बढ़ रही है, ${topic} का रहस्य मानवता के लिए प्रेरणा का स्रोत बना हुआ है।` },
    ];

    const englishTemplates = [
      { title: 'The Prologue', narration: `For generations, ${topic} has intrigued explorers, scientists, and historians across the globe.` },
      { title: 'Historical Origins', narration: `Early chronicles dating back centuries reveal the first recorded encounters with this remarkable phenomenon.` },
      { title: 'The First Incidents', narration: `Eyewitness accounts speak of unexpected occurrences that defied conventional explanation at the time.` },
      { title: 'Pivotal Turning Point', narration: `A dramatic event captured international headlines, permanently etching this subject into global consciousness.` },
      { title: 'Scientific Investigations', narration: `Modern researchers deployed cutting-edge sensors and analytical tools to measure environmental anomalies.` },
      { title: 'The Human Factor', narration: `Beyond the data lies human resilience and the relentless quest to comprehend the unexplained.` },
      { title: 'Contradicting Theories', narration: `Debates persist among leading scholars, as competing hypotheses challenge long-held assumptions.` },
      { title: 'Recent Discoveries', narration: `New satellite readings and archaeological evidence shed surprising light on previously hidden facets.` },
      { title: 'The Broader Impact', narration: `The lessons learned here continue to reshape our perspective on nature, technology, and civilization.` },
      { title: 'The Enduring Legacy', narration: `As exploration pushes further, the profound mystery of ${topic} remains a beacon for future discovery.` },
    ];

    const kidsHindiTemplates = [
      { title: 'चलो जानें', narration: `आज हम ${topic} की रंगीन और मज़ेदार दुनिया की खोज पर निकलेंगे।` },
      { title: 'पहला सवाल', narration: `क्या आपने कभी सोचा है कि ${topic} इतना खास और रोचक क्यों है?` },
      { title: 'नन्हा खोजी', narration: `हमारा जिज्ञासु दोस्त हर छोटे संकेत को ध्यान से देखकर नई बात सीखता है।` },
      { title: 'अद्भुत तथ्य', narration: `यह मज़ेदार तथ्य हमें विज्ञान और प्रकृति को नए तरीके से समझने में मदद करता है।` },
      { title: 'रंगों की दुनिया', narration: `चमकीले रंग और प्यारे आकार इस कहानी को याद रखना और भी आसान बनाते हैं।` },
      { title: 'मिलकर सीखें', narration: `दोस्तों के साथ सवाल पूछना हर खोज को अधिक मज़ेदार और उपयोगी बनाता है।` },
      { title: 'नई चुनौती', narration: `एक छोटी चुनौती हमें ध्यान से सोचने और सही उत्तर तक पहुँचने का मौका देती है।` },
      { title: 'समझ का जादू', narration: `जब कठिन बात सरल उदाहरण से समझ आती है, तो सीखना जादू जैसा लगता है।` },
      { title: 'हमने क्या सीखा', narration: `${topic} हमें जिज्ञासु रहने, ध्यान देने और नए सवाल पूछने की प्रेरणा देता है।` },
      { title: 'अगली खोज', narration: `हमारी कहानी पूरी हुई, लेकिन सीखने की अगली रोमांचक यात्रा अभी बाकी है।` },
    ];

    const kidsEnglishTemplates = [
      { title: 'Let’s Explore', narration: `Today we are setting off to explore the colorful and surprising world of ${topic}.` },
      { title: 'A Big Question', narration: `Have you ever wondered what makes ${topic} so special and interesting?` },
      { title: 'Our Curious Guide', narration: `Our friendly explorer looks closely at every clue and discovers something new.` },
      { title: 'Amazing Fact', narration: `This amazing fact helps us understand science and nature in a simple new way.` },
      { title: 'Shapes and Colors', narration: `Bright colors and friendly shapes make this big idea easier to remember.` },
      { title: 'Learning Together', narration: `Asking questions with friends can make every discovery more useful and fun.` },
      { title: 'A Tiny Challenge', narration: `A playful challenge invites us to think carefully and find the answer together.` },
      { title: 'The Idea Clicks', narration: `When a difficult idea meets a simple example, learning can feel like magic.` },
      { title: 'What We Learned', narration: `${topic} reminds us to stay curious, notice details, and keep asking why.` },
      { title: 'Next Adventure', narration: `Our story is ending, but another exciting learning adventure is just beginning.` },
    ];

    const entertainmentKidsTemplates = isHindi ? [
      { title: 'मज़ेदार शुरुआत', narration: `${topic} की दुनिया में आज एक बहुत ही मज़ेदार दिन शुरू होने वाला है।` },
      { title: 'प्यारे दोस्त', narration: `हमारे चुलबुले दोस्त हँसी और शरारत के साथ एक नया खेल खोजते हैं।` },
      { title: 'उलटी योजना', narration: `उनकी शानदार योजना अचानक उलटी पड़ती है और सबको हँसी आ जाती है।` },
      { title: 'जादुई आश्चर्य', narration: `एक चमकीला आश्चर्य कहानी को रंगों और मज़ेदार आवाज़ों से भर देता है।` },
      { title: 'हँसी की दौड़', narration: `दोस्त एक निराली दौड़ में भागते हैं जहाँ जीत से ज़्यादा मज़ा जरूरी है।` },
      { title: 'नया किरदार', narration: `तभी एक प्यारा नया किरदार आता है और खेल और भी दिलचस्प बन जाता है।` },
      { title: 'सबसे बड़ी शरारत', narration: `एक मासूम शरारत सबको चौंकाती है, लेकिन कोई भी अपनी हँसी रोक नहीं पाता।` },
      { title: 'मिलकर धमाल', narration: `सभी दोस्त मिलकर गाते, नाचते और अपनी कल्पना से नई दुनिया बनाते हैं।` },
      { title: 'खुशियों का पल', narration: `आखिर में हर किरदार अपनी पसंदीदा मज़ेदार याद सबके साथ बाँटता है।` },
      { title: 'फिर मिलेंगे', narration: `${topic} की यह हँसती कहानी अगली शरारत के वादे के साथ पूरी होती है।` },
    ] : [
      { title: 'A Funny Beginning', narration: `A wonderfully silly day is about to begin in the world of ${topic}.` },
      { title: 'Meet the Crew', narration: `Our playful friends invent a new game filled with giggles and surprising rules.` },
      { title: 'The Plan Flips', narration: `Their brilliant plan turns upside down, and nobody can stop laughing.` },
      { title: 'A Sparkly Surprise', narration: `A colorful surprise fills the story with funny sounds and bouncing shapes.` },
      { title: 'The Wacky Race', narration: `The friends enter a race where having fun matters much more than winning.` },
      { title: 'A New Friend', narration: `A lovable new character arrives and makes the game even more ridiculous.` },
      { title: 'The Big Mix-Up', narration: `A harmless mix-up surprises everyone and creates the funniest moment yet.` },
      { title: 'Party Together', narration: `The whole crew sings, dances, and builds a new world from imagination.` },
      { title: 'Favorite Moment', narration: `Each friend shares the funniest memory from their bright and busy day.` },
      { title: 'See You Soon', narration: `Our ${topic} story ends with smiles and a promise of another playful adventure.` },
    ];

    const adventureKidsTemplates = isHindi ? [
      { title: 'रोमांच का बुलावा', narration: `${topic} की दुनिया से एक चमकीला संदेश हमारे बहादुर दोस्तों को बुलाता है।` },
      { title: 'तैयारी', narration: `दोस्त नक्शा, नाश्ता और ढेर सारी हिम्मत लेकर सुरक्षित यात्रा शुरू करते हैं।` },
      { title: 'रंगीन रास्ता', narration: `उनका रास्ता तैरते पत्थरों और गुनगुनाते पेड़ों के बीच से गुजरता है।` },
      { title: 'पहेली वाला पुल', narration: `आगे बढ़ने के लिए टीम को एक मज़ेदार पहेली मिलकर हल करनी होती है।` },
      { title: 'नन्हा मददगार', narration: `एक छोटा दोस्त सही दिशा दिखाकर पूरी टीम की मदद करता है।` },
      { title: 'कल्पना की उड़ान', narration: `वे अपनी कल्पना से एक अनोखी सवारी बनाकर बादलों के पार निकल जाते हैं।` },
      { title: 'खोया हुआ खजाना', narration: `खजाना सोना नहीं, बल्कि दोस्ती और साहस से भरा एक चमकता संदेश निकलता है।` },
      { title: 'घर की राह', narration: `टीम मिलकर सुरक्षित रास्ता चुनती है और हर साथी का ध्यान रखती है।` },
      { title: 'विजय उत्सव', narration: `घर लौटकर सभी अपनी खोज का जश्न संगीत, रंग और हँसी के साथ मनाते हैं।` },
      { title: 'अगला नक्शा', narration: `एक नया नक्शा बताता है कि अगला सुरक्षित रोमांच जल्द शुरू होने वाला है।` },
    ] : [
      { title: 'The Adventure Call', narration: `A glowing message from ${topic} invites our brave friends on a quest.` },
      { title: 'Ready to Go', narration: `They pack a map, snacks, and plenty of courage for a safe journey.` },
      { title: 'The Colorful Path', narration: `Their path winds between floating stones and trees that hum cheerful songs.` },
      { title: 'The Puzzle Bridge', narration: `The team must solve a playful puzzle together before crossing the bridge.` },
      { title: 'A Tiny Helper', narration: `A small new friend appears and points everyone toward the right path.` },
      { title: 'Flight of Imagination', narration: `They build a fantastic ride and sail safely above the sparkling clouds.` },
      { title: 'The Hidden Treasure', narration: `The treasure is a glowing message about friendship, courage, and helping others.` },
      { title: 'The Way Home', narration: `The team chooses a safe route home and makes sure nobody is left behind.` },
      { title: 'Victory Celebration', narration: `Everyone celebrates the discovery with music, colors, laughter, and a happy dance.` },
      { title: 'The Next Map', narration: `A brand-new map hints that another friendly adventure will begin very soon.` },
    ];

    const bedtimeKidsTemplates = isHindi ? [
      { title: 'शांत शाम', narration: `${topic} की दुनिया में शाम की नरम रोशनी धीरे-धीरे फैल रही है।` },
      { title: 'चाँद का नमस्ते', narration: `गोल चाँद खिड़की से झाँककर सभी प्यारे दोस्तों को शुभ रात्रि कहता है।` },
      { title: 'तारों की फुसफुसाहट', narration: `छोटे तारे धीमी चमक के साथ एक मीठी और शांत धुन सुनाते हैं।` },
      { title: 'नरम बादल', narration: `एक मुलायम बादल हमारे दोस्त को सपनों की आरामदायक सैर पर ले जाता है।` },
      { title: 'जुगनू की रोशनी', narration: `नन्हा जुगनू सुरक्षित रास्ते पर अपनी सुनहरी रोशनी बिखेरता चलता है।` },
      { title: 'नींद वाला जंगल', narration: `पेड़, फूल और पक्षी धीरे-धीरे आँखें बंद करके आराम करने लगते हैं।` },
      { title: 'प्यारी याद', narration: `हमारा दोस्त दिन की सबसे खुश याद को दिल में सँभालकर मुस्कुराता है।` },
      { title: 'आराम का घर', narration: `गर्म और आरामदायक घर पास आता है, जहाँ मुलायम बिस्तर इंतज़ार कर रहा है।` },
      { title: 'शुभ रात्रि', narration: `सब दोस्त एक-दूसरे को शुभ रात्रि कहते हैं और कमरा शांत हो जाता है।` },
      { title: 'मीठे सपने', narration: `${topic} की कहानी तारों के नीचे मीठे सपनों के साथ धीरे से पूरी होती है।` },
    ] : [
      { title: 'A Quiet Evening', narration: `Soft evening light slowly settles across the gentle world of ${topic}.` },
      { title: 'Hello, Moon', narration: `The round moon peeks through the window and quietly says goodnight.` },
      { title: 'Whispering Stars', narration: `Tiny stars twinkle softly and hum a calm, sleepy little tune.` },
      { title: 'The Soft Cloud', narration: `A fluffy cloud carries our friend on a slow and cozy dream ride.` },
      { title: 'Firefly Lantern', narration: `A tiny firefly lights the safe path with a warm golden glow.` },
      { title: 'The Sleepy Forest', narration: `Trees, flowers, and birds close their eyes and settle down to rest.` },
      { title: 'A Happy Memory', narration: `Our friend smiles while remembering the happiest moment of the day.` },
      { title: 'Home and Cozy', narration: `A warm home appears nearby, with a soft bed waiting inside.` },
      { title: 'Goodnight, Friends', narration: `Every friend says goodnight as the peaceful room becomes quiet and still.` },
      { title: 'Sweet Dreams', narration: `The ${topic} story gently ends beneath the stars with sweet and happy dreams.` },
    ];

    const rhymeKidsTemplates = isHindi ? [
      { title: 'संगीत की शुरुआत', narration: `${topic} की धुन बजाओ, ताली देकर साथ में गाओ।` },
      { title: 'पहली तुक', narration: `नन्हे कदम आगे बढ़ते, हँसते-गाते सपने सजते।` },
      { title: 'रंगों का गीत', narration: `लाल और पीला, नीला महान, रंगों के संग नाचे जहान।` },
      { title: 'दोहराओ', narration: `गाओ फिर से प्यारी बात, मिलकर झूमें दिन और रात।` },
      { title: 'जानवरों की टोली', narration: `भालू बजाए ढोल सुहाना, बिल्ली गाए मीठा गाना।` },
      { title: 'गिनती की ताल', narration: `एक दो तीन, ताल रंगीन, चार पाँच छह, नाचें हम यहीं।` },
      { title: 'मज़ेदार पुल', narration: `छोटी सी तुक, प्यारी सी धुन, साथ में गाएँ हम सब सुन।` },
      { title: 'फिर से कोरस', narration: `${topic} की धुन बजाओ, ताली देकर साथ में गाओ।` },
      { title: 'अंतिम नाच', narration: `घूमो झूमो हँसो मुस्काओ, अपनी प्यारी तुक बनाओ।` },
      { title: 'विदाई गीत', narration: `गीत हुआ पूरा आज, फिर मिलेंगे नई धुन के साथ।` },
    ] : [
      { title: 'Music Begins', narration: `Play the tune for ${topic}, clap your hands and sing along.` },
      { title: 'First Rhyme', narration: `Tiny feet go tap tap tap, happy hands go clap clap clap.` },
      { title: 'Color Song', narration: `Red and yellow, blue so bright, dancing colors feel just right.` },
      { title: 'Sing Again', narration: `Sing it softly, sing it loud, share the rhythm with the crowd.` },
      { title: 'Animal Band', narration: `Bear plays drums with boom boom boom, kitty sings across the room.` },
      { title: 'Counting Beat', narration: `One two three, dance with me, four five six, musical tricks.` },
      { title: 'Rhyme Bridge', narration: `Little rhyme and little tune, bouncing underneath the moon.` },
      { title: 'Chorus Again', narration: `Play the tune for ${topic}, clap your hands and sing along.` },
      { title: 'Final Dance', narration: `Spin around and touch the ground, make your own fantastic sound.` },
      { title: 'Goodbye Song', narration: `Our rhyme is done but not for long, we will meet in another song.` },
    ];

    const templates = contentStyle === 'kids'
      ? (kidsFormat === 'educational'
          ? (isHindi ? kidsHindiTemplates : kidsEnglishTemplates)
          : kidsFormat === 'adventure'
            ? adventureKidsTemplates
            : kidsFormat === 'bedtime'
              ? bedtimeKidsTemplates
              : kidsFormat === 'rhyme'
                ? rhymeKidsTemplates
                : entertainmentKidsTemplates)
      : (isHindi ? hindiTemplates : englishTemplates);

    const scenes: SceneItem[] = [];
    for (let i = 0; i < totalScenes; i++) {
      const tmpl = templates[i % templates.length];
      const sceneNum = i + 1;
      const title = totalScenes > 10
        ? `${tmpl.title} (${isHindi ? 'भाग' : 'Part'} ${Math.floor(i / 10) + 1})`
        : tmpl.title;
      scenes.push({
        sceneNumber: sceneNum,
        title,
        narration: tmpl.narration,
        imagePrompt: `${contentStyle === 'kids' ? `Friendly children's ${kidsFormat} story scene` : 'Cinematic documentary scene'} of ${topic}, ${tmpl.title}, ${visualStyle}`,
        approxDurationSeconds: sceneDurationSec,
        subtitleText: tmpl.narration,
        imageStatus: 'pending',
        audioStatus: 'pending',
      });
    }

    return {
      summary: contentStyle === 'kids'
        ? (isHindi ? `${topic} पर बच्चों के लिए एक रंगीन और सुरक्षित ${kidsFormat} कहानी।` : `A colorful, safe ${durationMinutes}-minute ${kidsFormat} story for children about ${topic}.`)
        : (isHindi ? `${topic} के रहस्य और इतिहास पर आधारित एक प्रभावशाली वृत्तचित्र।` : `A gripping ${durationMinutes}-minute exploration into the depth and mystery of ${topic}.`),
      scenes,
    };
  }
}
