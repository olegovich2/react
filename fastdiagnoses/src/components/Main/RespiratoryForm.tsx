import React, { useState, FormEvent } from 'react';
import { titleStates } from '../../constants/allConstants';
import { getDiagnosisRecommendations } from '../../api/surveys.api';
import { Survey } from '../../components/AccountPage/types/account.types';
import { historyTaking, formatedSymbolInName } from '../../utils/formatters';
import './RespiratoryForm.css'; // Импорт стилей

interface RespiratoryFormProps {
  onSubmit: (survey: Survey) => void;
}

const RespiratoryForm: React.FC<RespiratoryFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    nameSurname: '',
    age: '',
    temperature: '',
    weightBody: '',
    soreThroat: '0',
    plaquesTonsils: '0',
    runnyNose: '0',
    pollinosis: '0',
    cough: '0',
    dyspnoea: '',
    sputum: '0',
    hemoptysis: '0',
    chestPainBreathing: '0',
    daysDisease: '',
    frequentPneumonia: '0',
    bronchialAsthmaAnamnesis: '0',
    bronchialAsthmaConfirmed: '0',
    asthmaAttacks: '0',
    smoking: '0',
    powder: '0',
    vape: '0',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Сбор данных и создание персональных данных (полная копия из respiratory.js)
      const personalData: any = {};
      const mixDiagnoses: string[] = [];
      const otherGuidelines: string[] = [];
      const date = new Date();
      
      personalData.date = date.toLocaleString("en-US", { hour12: false });
      personalData.nameSurname = formatedSymbolInName(formData.nameSurname);
      personalData.age = Number(formData.age);
      personalData.temperature = `${formData.temperature}\u00B0C`;

      const weightBody = Number(formData.weightBody);
      if (weightBody) {
        otherGuidelines.push(`Обильное питье в объеме ${weightBody * 30}мл в сутки.`);
      }

      // Логика определения диагнозов (полная копия из respiratory.js)
      const soreThroat = Number(formData.soreThroat);
      const plaquesTonsils = Number(formData.plaquesTonsils);
      const runnyNose = Number(formData.runnyNose);
      const pollinosis = Number(formData.pollinosis);
      let cough = Number(formData.cough);

      const dyspnoea = Number(formData.dyspnoea);
      const sputum = Number(formData.sputum);
      const hemoptysis = Number(formData.hemoptysis);
      const chestPainBreathing = Number(formData.chestPainBreathing);
      const daysDisease = Number(formData.daysDisease);
      const frequentPneumonia = Number(formData.frequentPneumonia);
      const bronchialAsthmaAnamnesis = Number(formData.bronchialAsthmaAnamnesis);
      const bronchialAsthmaConfirmed = Number(formData.bronchialAsthmaConfirmed);
      const asthmaAttacks = Number(formData.asthmaAttacks);
      const smoking = Number(formData.smoking);
      const powder = Number(formData.powder);
      const vape = Number(formData.vape);

      // Логика из respiratory.js
      if (sputum > 0) cough = 2;
      
      if (daysDisease <= 28) {
        if (runnyNose > 0 && pollinosis === 0) mixDiagnoses.push(titleStates.acuteRhinitis);
        if (soreThroat > 0 && plaquesTonsils > 0) mixDiagnoses.push(titleStates.acuteTonsillitis);
        if (soreThroat > 0 && plaquesTonsils === 0) mixDiagnoses.push(titleStates.acutePharyngitis);
        if (cough === 1) mixDiagnoses.push(titleStates.acuteTracheitis);
        if (cough === 2 && sputum > 0) mixDiagnoses.push(titleStates.acuteBronchitis);
        if (cough === 2 && sputum > 0 && dyspnoea > 20) mixDiagnoses.push(titleStates.acuteObstructiveBronchitis);
        if (cough === 2 && sputum > 0 && asthmaAttacks > 0) mixDiagnoses.push(titleStates.acuteBronchiolitis);
        if (cough === 2 && sputum > 0 && chestPainBreathing > 0) mixDiagnoses.push(titleStates.pleuritis);
        if (cough === 2 && sputum > 0 && frequentPneumonia > 0) mixDiagnoses.push(titleStates.bronchoectaticLungCondition);
      } else {
        if (runnyNose > 0 && pollinosis === 0) mixDiagnoses.push(titleStates.chronicRhinitis);
        if (soreThroat > 0 && plaquesTonsils > 0) mixDiagnoses.push(titleStates.chronicTonsillitis);
        if (soreThroat > 0 && plaquesTonsils === 0) mixDiagnoses.push(titleStates.chronicPharyngitis);
        if (cough === 1) mixDiagnoses.push(titleStates.cough);
        if (cough === 2 && sputum > 0) mixDiagnoses.push(titleStates.chronicBronchitis);
        if (cough === 2 && sputum > 0 && dyspnoea > 20) mixDiagnoses.push(titleStates.copd);
        if (cough === 2 && sputum > 0 && asthmaAttacks > 0) mixDiagnoses.push(titleStates.copd);
        if (cough === 2 && sputum > 0 && frequentPneumonia > 0) mixDiagnoses.push(titleStates.bronchoectaticLungCondition);
      }
      
      if (bronchialAsthmaAnamnesis + asthmaAttacks === 2) mixDiagnoses.push(titleStates.bronchialAsthma);
      if (cough === 2 && sputum > 0 && dyspnoea > 20) {
        if (hemoptysis === 0) mixDiagnoses.push(titleStates.pneumonia);
        if (hemoptysis === 1) mixDiagnoses.push(titleStates.pneumoniaWithBloodThroating);
        if (hemoptysis === 2) mixDiagnoses.push(
          titleStates.pneumoniaWithBloodThroating,
          titleStates.pulmonaryTuberculosis,
          titleStates.tela,
          titleStates.pulmonaryInfarction
        );
      }
      
      if (hemoptysis === 1) mixDiagnoses.push(titleStates.pneumoniaWithBloodThroating);
      if (hemoptysis === 2) mixDiagnoses.push(
        titleStates.pneumoniaWithBloodThroating,
        titleStates.pulmonaryTuberculosis,
        titleStates.tela,
        titleStates.pulmonaryInfarction
      );
      
      if (runnyNose > 0 && pollinosis > 0) mixDiagnoses.push(titleStates.pollinosis);
      if (bronchialAsthmaConfirmed > 0) mixDiagnoses.push(titleStates.bronchialAsthma);
      if (cough === 2 && sputum > 0 && dyspnoea > 20 && smoking + powder + vape >= 10) {
        mixDiagnoses.push(titleStates.copd);
      }
      
      if (powder > 0) otherGuidelines.push(titleStates.respiratoryProtection);
      if (smoking + vape > 0) otherGuidelines.push(titleStates.rejectionBadHabits);
      
      if (
        soreThroat +
        plaquesTonsils +
        runnyNose +
        pollinosis +
        cough +
        sputum +
        hemoptysis +
        chestPainBreathing +
        bronchialAsthmaAnamnesis +
        bronchialAsthmaConfirmed +
        asthmaAttacks === 0
      ) {
        mixDiagnoses.push(titleStates.noPathology);
      }

      const uniqueDiagnoses = Array.from(new Set(mixDiagnoses));
      personalData.title = uniqueDiagnoses;
      
      // 2. Создание анамнеза
      personalData.anamnesis = historyTaking(formData);
      personalData.otherGuidelines = otherGuidelines;

      // 3. Отправляем на сервер для получения рекомендаций
      const result = await getDiagnosisRecommendations(personalData.title);

      if (result.success && result.data) {
        // 4. Объединяем данные с рекомендациями
        const completeSurvey: Survey = {
          ...personalData,
          title: result.data.title || [],
          diagnostic: result.data.diagnostic || [],
          treatment: result.data.treatment || [],
        };

        // 5. Вызываем callback с результатом
        onSubmit(completeSurvey);
      }

    } catch (error) {
      console.error('Ошибка при отправке формы:', error);
      alert('Произошла ошибка при обработке формы');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="forms_content" id="respiratory">
      <form data-form="respiratory" onSubmit={handleSubmit}>
        {/* Все поля точно как в вашем HTML */}
        
        <fieldset data-fieldset="nameSurname">
          <legend>Фамилия Имя Отчество</legend>
          <input 
            className="input_length" 
            type="text" 
            id="nameSurname" 
            name="nameSurname"
            placeholder="Фамилия Имя Отчество"
            value={formData.nameSurname}
            onChange={handleChange}
            required
          />
        </fieldset>

        <fieldset data-fieldset="age">
          <legend>Полных лет</legend>
          <input 
            type="number" 
            id="age" 
            name="age"
            placeholder="Например: 24"
            value={formData.age}
            onChange={handleChange}
            min="0"
            max="150"
            required
          />
        </fieldset>

        <fieldset data-fieldset="temperature">
          <legend>Температура</legend>
          <input 
            type="number" 
            step="0.1"
            id="temperature" 
            name="temperature"
            placeholder="Например: 37.8"
            value={formData.temperature}
            onChange={handleChange}
            min="35"
            max="45"
            required
          />
        </fieldset>

        <fieldset data-fieldset="weightBody">
          <legend>Вес</legend>
          <input 
            type="number" 
            id="weightBody" 
            name="weightBody"
            placeholder="Например: 51"
            value={formData.weightBody}
            onChange={handleChange}
            min="20"
            max="300"
          />
        </fieldset>

        <fieldset data-fieldset="soreThroat">
          <legend>Боль в горле</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="soreThroatNone" 
              name="soreThroat" 
              value="0" 
              checked={formData.soreThroat === '0'}
              onChange={handleChange}
            />
            <label htmlFor="soreThroatNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="soreThroatYes" 
              name="soreThroat" 
              value="1"
              checked={formData.soreThroat === '1'}
              onChange={handleChange}
            />
            <label htmlFor="soreThroatYes">Да</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="plaquesTonsils">
          <legend>Налеты на миндалинах</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="plaquesTonsilsNone" 
              name="plaquesTonsils" 
              value="0"
              checked={formData.plaquesTonsils === '0'}
              onChange={handleChange}
            />
            <label htmlFor="plaquesTonsilsNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="plaquesTonsilsYes" 
              name="plaquesTonsils" 
              value="1"
              checked={formData.plaquesTonsils === '1'}
              onChange={handleChange}
            />
            <label htmlFor="plaquesTonsilsYes">Да</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="runnyNose">
          <legend>Насморк</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="runnyNoseNone" 
              name="runnyNose" 
              value="0"
              checked={formData.runnyNose === '0'}
              onChange={handleChange}
            />
            <label htmlFor="runnyNoseNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="runnyNoseYes" 
              name="runnyNose" 
              value="1"
              checked={formData.runnyNose === '1'}
              onChange={handleChange}
            />
            <label htmlFor="runnyNoseYes">Да</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="pollinosis">
          <legend>Есть ли у Вас аллергическая реакция на цветение растений, на пыль, на домашних животных?</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="pollinosisNone" 
              name="pollinosis" 
              value="0"
              checked={formData.pollinosis === '0'}
              onChange={handleChange}
            />
            <label htmlFor="pollinosisNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="pollinosisYes" 
              name="pollinosis" 
              value="1"
              checked={formData.pollinosis === '1'}
              onChange={handleChange}
            />
            <label htmlFor="pollinosisYes">Да</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="cough">
          <legend>Кашель</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="coughNone" 
              name="cough" 
              value="0"
              checked={formData.cough === '0'}
              onChange={handleChange}
            />
            <label htmlFor="coughNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="coughDry" 
              name="cough" 
              value="1"
              checked={formData.cough === '1'}
              onChange={handleChange}
            />
            <label htmlFor="coughDry">Сухой</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="coughWet" 
              name="cough" 
              value="2"
              checked={formData.cough === '2'}
              onChange={handleChange}
            />
            <label htmlFor="coughWet">Влажный</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="dyspnoea">
          <legend>Число дыханий</legend>
          <input 
            type="number" 
            id="dyspnoea" 
            name="dyspnoea"
            placeholder="Число вдохов за минуту"
            value={formData.dyspnoea}
            onChange={handleChange}
            min="10"
            max="60"
          />
        </fieldset>

        <fieldset data-fieldset="sputum">
          <legend>Мокрота</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="sputumNone" 
              name="sputum" 
              value="0"
              checked={formData.sputum === '0'}
              onChange={handleChange}
            />
            <label htmlFor="sputumNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="sputumWhite" 
              name="sputum" 
              value="1"
              checked={formData.sputum === '1'}
              onChange={handleChange}
            />
            <label htmlFor="sputumWhite">Мокрота прозрачная или белая</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="sputumBacterial" 
              name="sputum" 
              value="2"
              checked={formData.sputum === '2'}
              onChange={handleChange}
            />
            <label htmlFor="sputumBacterial">Мокрота желтая, зеленоватая и их оттенки</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="hemoptysis">
          <legend>Кровохарканье</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="hemoptysisNone" 
              name="hemoptysis" 
              value="0"
              checked={formData.hemoptysis === '0'}
              onChange={handleChange}
            />
            <label htmlFor="hemoptysisNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="hemoptysisPink" 
              name="hemoptysis" 
              value="1"
              checked={formData.hemoptysis === '1'}
              onChange={handleChange}
            />
            <label htmlFor="hemoptysisPink">Мокрота розовая, или прожилки крови в мокроте</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="hemoptysisBlood" 
              name="hemoptysis" 
              value="2"
              checked={formData.hemoptysis === '2'}
              onChange={handleChange}
            />
            <label htmlFor="hemoptysisBlood">Алая кровь при кашле</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="chestPainBreathing">
          <legend>Боль в грудной клетке при дыхании</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="chestPainBreathingNone" 
              name="chestPainBreathing" 
              value="0"
              checked={formData.chestPainBreathing === '0'}
              onChange={handleChange}
            />
            <label htmlFor="chestPainBreathingNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="chestPainBreathingYes" 
              name="chestPainBreathing" 
              value="1"
              checked={formData.chestPainBreathing === '1'}
              onChange={handleChange}
            />
            <label htmlFor="chestPainBreathingYes">Да</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="daysDisease">
          <legend>Сколько дней болеете?</legend>
          <input 
            type="number" 
            id="daysDisease" 
            name="daysDisease"
            placeholder="Например: 15"
            value={formData.daysDisease}
            onChange={handleChange}
            min="1"
            max="365"
          />
        </fieldset>

        <fieldset data-fieldset="frequentPneumonia">
          <legend>Вы ранее болели пневмонией?</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="frequentPneumoniaNone" 
              name="frequentPneumonia" 
              value="0"
              checked={formData.frequentPneumonia === '0'}
              onChange={handleChange}
            />
            <label htmlFor="frequentPneumoniaNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="frequentPneumoniaYes" 
              name="frequentPneumonia" 
              value="1"
              checked={formData.frequentPneumonia === '1'}
              onChange={handleChange}
            />
            <label htmlFor="frequentPneumoniaYes">Да</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="bronchialAsthmaAnamnesis">
          <legend>Выставлен ли у родственников диагноз: "Бронхиальная астма"?</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="bronchialAsthmaAnamnesisNone" 
              name="bronchialAsthmaAnamnesis" 
              value="0"
              checked={formData.bronchialAsthmaAnamnesis === '0'}
              onChange={handleChange}
            />
            <label htmlFor="bronchialAsthmaAnamnesisNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="bronchialAsthmaAnamnesisYes" 
              name="bronchialAsthmaAnamnesis" 
              value="1"
              checked={formData.bronchialAsthmaAnamnesis === '1'}
              onChange={handleChange}
            />
            <label htmlFor="bronchialAsthmaAnamnesisYes">Да</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="bronchialAsthmaConfirmed">
          <legend>Выставлен ли у Вас диагноз: "Бронхиальная астма"?</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="bronchialAsthmaConfirmedNone" 
              name="bronchialAsthmaConfirmed" 
              value="0"
              checked={formData.bronchialAsthmaConfirmed === '0'}
              onChange={handleChange}
            />
            <label htmlFor="bronchialAsthmaConfirmedNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="bronchialAsthmaConfirmedYes" 
              name="bronchialAsthmaConfirmed" 
              value="1"
              checked={formData.bronchialAsthmaConfirmed === '1'}
              onChange={handleChange}
            />
            <label htmlFor="bronchialAsthmaConfirmedYes">Да</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="asthmaAttacks">
          <legend>Были ли у Вас приступы удушья?</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="asthmaAttacksNone" 
              name="asthmaAttacks" 
              value="0"
              checked={formData.asthmaAttacks === '0'}
              onChange={handleChange}
            />
            <label htmlFor="asthmaAttacksNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="asthmaAttacksYes" 
              name="asthmaAttacks" 
              value="1"
              checked={formData.asthmaAttacks === '1'}
              onChange={handleChange}
            />
            <label htmlFor="asthmaAttacksYes">Да</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="smoking">
          <legend>Табакокурение</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="smokingNone" 
              name="smoking" 
              value="0"
              checked={formData.smoking === '0'}
              onChange={handleChange}
            />
            <label htmlFor="smokingNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="smokingYes" 
              name="smoking" 
              value="5"
              checked={formData.smoking === '5'}
              onChange={handleChange}
            />
            <label htmlFor="smokingYes">Да</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="powder">
          <legend>Работа на производстве, где присутствует пыль или аэрозоль(металлообработка, окрашивание, фасовка удобрений, деревообработка и др.)</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="powderNone" 
              name="powder" 
              value="0"
              checked={formData.powder === '0'}
              onChange={handleChange}
            />
            <label htmlFor="powderNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="powderYes" 
              name="powder" 
              value="5"
              checked={formData.powder === '5'}
              onChange={handleChange}
            />
            <label htmlFor="powderYes">Да</label>
          </div>
        </fieldset>

        <fieldset data-fieldset="vape">
          <legend>Использование систем для употребления никотина без горения</legend>
          <div className="radio-option">
            <input 
              type="radio" 
              id="vapeNone" 
              name="vape" 
              value="0"
              checked={formData.vape === '0'}
              onChange={handleChange}
            />
            <label htmlFor="vapeNone">Нет</label>
          </div>
          <div className="radio-option">
            <input 
              type="radio" 
              id="vapeYes" 
              name="vape" 
              value="5"
              checked={formData.vape === '5'}
              onChange={handleChange}
            />
            <label htmlFor="vapeYes">Да</label>
          </div>
        </fieldset>

        <button 
          className="buttonFromAnamnesis" 
          type="submit" 
          data-button="respiratory"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Обработка...' : 'Предварительный диагноз'}
        </button>
      </form>
    </section>
  );
};

export default RespiratoryForm;