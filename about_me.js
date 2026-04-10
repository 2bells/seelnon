export function openAboutMeWindow(title, openWindowFn) {
  const aboutMeContentData = {
    overview: {
      title: 'About Me - Overview',
      text: `
        <p>Welcome! This is a rough overview of my 'character'.</p>
        <p>I like making stuff, tinkering with things and building up experiences with everything creative.</p>
        <p>My journey led me to develop multiple skillsets. My main idea was to concentrate on understanding the concept of 'learning' itself, so I can explore and apply skills from other adjacent creative spheres and be ready to go further, when needed. Without fear, doubt, syndromes, with a clear mind and clear heart. Ready to fail.</p>
        <p>Click on the equipment slots to learn more about my skills, strengths, and experience.</p>
        <p>Check my HP and MP for current vitality and focus levels!</p>
        <p class="subdued-text">(Those things are mostly my inner evaluations of myself, you can see them as 'self-proclaimed'.)</p>
      `
    },
    head: {
      title: 'Head: Creative mind has creative problems',
      text: `
        <p>My mind is a force of nature that knows how to work against me:</p>
        <ul>
            <li><span class="highlight-text">Strategic Thinking & Problem Solving:</span> Overthinking is the best description to my core. Gets me out tough situations, finds creative solutions. But it can flip my reality into 40k Warhammer.</li>
            <li><span class="highlight-text">Continuous Learning:</span> When not in burnout, I'm on a grind. I have problems with proper rest and understanding when it is time to stop and relax.</li>
            <li><span class="highlight-text">Data Analysis & Visualization:</span> My mind sees the world as an ever expanding kaleidoscope. Wells of lights that contain meanings, languages, images, sounds, tastes, smells, touch itself. I search for strings that feel familiar to a situation and pull them out on the surface of my mind and decode them into something concrete, like this exact text that I’m writing right now. That allows me to work on a much deeper level with any task, person, idea or meaning itself.</li>
        </ul>
        <p class="subdued-text">(Intellect +9, Wisdom +13)</p>
      `
    },
    torso: {
      title: 'Torso: The heart, The sun, The past.',
      text: `
        <p>Things I put my heart out for:</p>
        <ul>
            <li><span class="highlight-text">Video editing, VFX, Storyboarding: Started with Battlefield 3 (EA Russia), transitioned into creative agency 'Red Keds' and since 2014 a 'gun for hire' working with Yandex. + Freelance</li>
            <li><span class="highlight-text">Deadlines and stress:</span> I have an arrangement of breathing techniques with quick access to a flow state. Allows me to do very impressive short sprints, but has a side effect of compounding fatigue, that... has consequences to my health in general.</li>
            <li><span class="highlight-text">Game Design, Arts, Logic:</span> I approach design as a 'logic artist'. Concrete solutions are derived from my abstract thinking, rather than rules and 'common practices'. Could be hard to integrate into a team environment, as my ideas are usually 'out there'. Works for me, but not always for the others.</li>
        </ul>
        <p class="subdued-text">(Endurance +4, Leadership -3)</p>
      `
    },
    hands: {
      title: 'Hands: When they work, they make wonders',
      text: `
        <p>With these hands, I craft:</p>
        <ul>
            <li><span class="highlight-text">Front-End:</span> If I can imagine it, I can make it (limitations apply).</li>
            <li><span class="highlight-text">Back-End:</span> please no.</li>
            <li><span class="highlight-text">Software:</span> just learn it.</li>
        </ul>
        <p class="subdued-text">(Dexterity +15, Craftsmanship +14)</p>
      `
    },
    legs: {
      title: 'Legs: I usually just stand there, menacingly.',
      text: `
        <p>Only moving forward, that's how time works:</p>
        <ul>
            <li><span class="highlight-text">Adaptability:</span> I know how to solve, survive or outlive the problem of... any kind (limitations apply).</li>
            <li><span class="highlight-text">Growth Mindset:</span> What doesn't kill you, does a poor job and just gives me more experience. ggs tho.</li>
            <li><span class="highlight-text">Global Perspective:</span> With my legs planted well, I can allow my mind to be ever present. The better my flower pot, the better my mind flowers.</li>
        </ul>
        <p class="subdued-text">(Agility +4, Globality +9)</p>
      `
    },
    talent1: {
      title: 'Talent: Debugging Oracle',
      text: `
        <p>I see the code, I feel the code. Not always, but when I do, it is beautiful.</p>
        <p class="subdued-text">Skill: Code Insight, Rank A</p>
      `
    },
    talent2: {
      title: 'Talent: Abstract Vision',
      text: `
        <p>I don't see things, I see substance of things. Sometimes works against me, but gives me keys to many vaults.</p>
        <p class="subdued-text">Skill: Intuitive Empath, Rank S+</p>
      `
    },
    talent3: {
      title: 'Talent: Coffee Connoisseur',
      text: `
        <p>Well... Self explanatory. Black, no sugar. Quantity: a lot. Quality: if good enough: good enough.</p>
        <p class="subdued-text">Skill: I like the Taste, Rank A+</p>
      `
    },
    healthReport: {
      title: 'Health Report: Half alive, not dead',
      text: `
        <p><span class="highlight-text">Current Health (HP):</span> 65% - Need to be very careful with that. Years of grind do not come without problems. In today's landscape my sleep is more important than my wake experiences. My active mind is too loud for my own body to handle nowadays, so a good night is a foundation for a good day.</p>	
        <p><span class="highlight-text">Current Energy Levels (MP):</span> 50% - Mana reserves are fine, but usually never overflow. I have a good/bad habbit of using my mana as soon as it gets over 50%. So I'm writing this as I feel it's getting to around 55%... But I can save up if I have a heads up for a big project coming.</p>
        <p class="subdued-text">Status Effects:</p>
        <ul>
            <li>Positive: <span class="highlight-text">'Vigilant'</span>, <span class="highlight-text">'Rapid'</span>.</li>
            <li>Negative: <span class="subdued-text">'Overwork'</span>, <span class="subdued-text">'Overbearing'</span>.</li>
        </ul>
        <p class="subdued-text">Overall status: Half dead, but alive.</p>
      `
    }
  };

  const aboutMeContainer = document.createElement('div');
  aboutMeContainer.className = 'about-me-container';

  aboutMeContainer.innerHTML = `
    <div class="equipment-ui">
        <div class="ui-header">
            <span class="hp-mp-label" data-slot="healthReport" title="View Health Report"><img src="icons/hp_bar_icon.png" alt="HP" width="10" height="10"> HP</span>
            <div class="hp-bar-container" data-slot="healthReport" title="View Health Report"><div class="hp-bar-fill" style="width: 65%;"></div></div>
            <span class="hp-mp-label" data-slot="healthReport" title="View Health Report"><img src="icons/mp_bar_icon.png" alt="MP" width="10" height="10"> MP</span>
            <div class="mp-bar-container" data-slot="healthReport" title="View Health Report"><div class="mp-bar-fill" style="width: 50%;"></div></div>
        </div>
        <div class="equipment-slots">
            <div class="slot head-slot" data-slot="head" title="Core Competencies"></div>
            <div class="slot torso-slot" data-slot="torso" title="Major Experience & Projects"></div>
            <div class="slot hands-slot" data-slot="hands" title="Practical Skills & Tools"></div>
            <div class="slot legs-slot" data-slot="legs" title="Adaptability & Future Growth"></div>
        </div>
        <div class="talent-slots">
            <div class="talent-slot" data-slot="talent1" title="Debugging Oracle"></div>
            <div class="talent-slot" data-slot="talent2" title="Pixel Perfect Vision"></div>
            <div class="talent-slot" data-slot="talent3" title="Coffee Connoisseur"></div>
        </div>
        <div class="overview-button-container">
            <button class="overview-btn" data-slot="overview">Overview</button>
        </div>
    </div>
    <div class="about-me-content">
        <h2 class="content-title"></h2>
        <div class="content-text"></div>
    </div>
  `;

  const contentTitleEl = aboutMeContainer.querySelector('.content-title');
  const contentTextEl = aboutMeContainer.querySelector('.content-text');
  const slots = aboutMeContainer.querySelectorAll('.slot, .talent-slot, .overview-btn, .hp-bar-container, .mp-bar-container, .hp-mp-label');

  const updateContent = (slotId) => {
    const data = aboutMeContentData[slotId];
    if (data) {
      contentTitleEl.innerHTML = data.title;
      contentTextEl.innerHTML = data.text;
    } else {
      // Fallback for initial state or unknown slots
      contentTitleEl.innerHTML = aboutMeContentData.overview.title;
      contentTextEl.innerHTML = aboutMeContentData.overview.text;
    }

    slots.forEach(s => s.classList.remove('active'));
    aboutMeContainer.querySelectorAll(`[data-slot="${slotId}"]`).forEach(el => el.classList.add('active'));
  };

  slots.forEach(slot => {
    slot.addEventListener('click', () => {
      updateContent(slot.dataset.slot);
    });
  });

  // Set initial content to overview
  updateContent('overview');

  // Open the window with the constructed content
  openWindowFn({
    title: title,
    content: aboutMeContainer,
    width: 800,
    height: 520,
    x: 160,
    y: 120
  });
}
