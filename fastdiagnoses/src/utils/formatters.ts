/**
 * Форматирует ФИО - каждое слово с заглавной буквы
 */
export const formatedSymbolInName = (nameSurname: string): string => {
  if (nameSurname.length > 0) {
    const arrayFromNameSurname = nameSurname.toLowerCase().split(' ');
    const newNameSurname = [];
    
    for (let i = 0; i < arrayFromNameSurname.length; i++) {
      const word = arrayFromNameSurname[i];
      if (word.length > 0) {
        const newArray = word.split('');
        newArray[0] = newArray[0].toUpperCase();
        newNameSurname.push(newArray.join(''));
      }
    }
    
    return newNameSurname.join(' ');
  }
  return '';
};

/**
 * Создает текстовый анамнез на основе данных формы
 * Полная копия функции из allFunctionsForWorkMain.js
 */
export const historyTaking = (formElements: Record<string, any>): string => {
  let overview = '';
  
  // Обрабатываем все поля формы
  for (const [key, value] of Object.entries(formElements)) {
    if (key === 'nameSurname' || key === 'age' || key === 'temperature') {
      continue; // Пропускаем основные поля
    }
    
    if (key === 'soreThroat') {
      overview += 'Боль в горле: ';
      overview += value === '1' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'plaquesTonsils') {
      overview += 'Налеты на миндалинах: ';
      overview += value === '1' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'runnyNose') {
      overview += 'Насморк: ';
      overview += value === '1' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'pollinosis') {
      overview += 'Аллергия на цветение/пыль/животных: ';
      overview += value === '1' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'cough') {
      overview += 'Кашель: ';
      if (value === '0') overview += 'Нет. ';
      else if (value === '1') overview += 'Сухой. ';
      else if (value === '2') overview += 'Влажный. ';
    }
    else if (key === 'dyspnoea' && value) {
      overview += `Число дыханий: ${value}. `;
    }
    else if (key === 'sputum') {
      overview += 'Мокрота: ';
      if (value === '0') overview += 'Нет. ';
      else if (value === '1') overview += 'Прозрачная или белая. ';
      else if (value === '2') overview += 'Желтая, зеленоватая. ';
    }
    else if (key === 'hemoptysis') {
      overview += 'Кровохарканье: ';
      if (value === '0') overview += 'Нет. ';
      else if (value === '1') overview += 'Розовая мокрота или прожилки крови. ';
      else if (value === '2') overview += 'Алая кровь при кашле. ';
    }
    else if (key === 'chestPainBreathing') {
      overview += 'Боль в грудной клетке при дыхании: ';
      overview += value === '1' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'daysDisease' && value) {
      overview += `Дней болеет: ${value}. `;
    }
    else if (key === 'frequentPneumonia') {
      overview += 'Болел пневмонией ранее: ';
      overview += value === '1' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'bronchialAsthmaAnamnesis') {
      overview += 'Бронхиальная астма у родственников: ';
      overview += value === '1' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'bronchialAsthmaConfirmed') {
      overview += 'Диагноз "Бронхиальная астма" у пациента: ';
      overview += value === '1' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'asthmaAttacks') {
      overview += 'Приступы удушья: ';
      overview += value === '1' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'smoking') {
      overview += 'Табакокурение: ';
      overview += value === '5' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'powder') {
      overview += 'Работа на пыльном производстве: ';
      overview += value === '5' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'vape') {
      overview += 'Использование вейпов: ';
      overview += value === '5' ? 'Да. ' : 'Нет. ';
    }
    else if (key === 'weightBody' && value) {
      overview += `Вес: ${value} кг. `;
    }
  }
  
  return overview.trim();
};

/**
 * Конвертирует ArrayBuffer в Base64
 */
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return window.btoa(binary);
};

/**
 * Форматирует дату для отображения
 */
export const formatDate = (date: Date): string => {
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Валидация email
 */
export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Валидация логина (без спецсимволов)
 */
export const validateLogin = (login: string): boolean => {
  const re = /^[a-zA-Z0-9_]+$/;
  return re.test(login) && login.length >= 3;
};

/**
 * Валидация пароля
 */
export const validatePassword = (password: string): boolean => {
  return password.length >= 6 && !password.includes(' ');
};

/**
 * Экранирование HTML символов
 */
export const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  
  return text.replace(/[&<>"']/g, (m) => map[m]);
};