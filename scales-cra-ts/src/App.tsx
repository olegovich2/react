import React, { useState} from 'react';
import { Scales, Apple, Tomato } from './classes';
import './App.css';

const App: React.FC = () => {
  const [scales] = useState(() => new Scales());
  const [totalWeight, setTotalWeight] = useState<number>(0);
  const [productList, setProductList] = useState<string[]>([]);
  const [productsInfo, setProductsInfo] = useState<Array<{name: string, weight: number}>>([]);

  
  const updateScalesInfo = () => {
    setTotalWeight(scales.getSumScale());
    setProductList(scales.getNameList());
    setProductsInfo(scales.getProductsInfo());
  };

  const handleAddApple = () => {
    const colors = ['красный', 'зелёный', 'жёлтый', 'розовый'];
    const varieties = ['десертный', 'кислый', 'сладкий', 'твёрдый'];
    const names = ['Гала', 'Фуджи', 'Ханикрисп', 'Ред Делишес'];
    
    const randomApple = new Apple(
      names[Math.floor(Math.random() * names.length)],
      parseFloat((Math.random() * 0.3 + 0.1).toFixed(2)), // 0.1 - 0.4 кг
      colors[Math.floor(Math.random() * colors.length)],
      varieties[Math.floor(Math.random() * varieties.length)]
    );
    
    scales.add(randomApple);
    updateScalesInfo();
  };

  const handleAddTomato = () => {
    const types = ['черри', 'биф', 'коктейльный', 'сливовидный'];
    const names = ['Бычье сердце', 'Де Барао', 'Розовый гигант', 'Санька'];
    
    const randomTomato = new Tomato(
      names[Math.floor(Math.random() * names.length)],
      parseFloat((Math.random() * 0.5 + 0.05).toFixed(2)), // 0.05 - 0.55 кг
      Math.random() > 0.3, // 70% chance ripe
      types[Math.floor(Math.random() * types.length)]
    );
    
    scales.add(randomTomato);
    updateScalesInfo();
  };

  const handleClearScales = () => {
    scales.clear();
    updateScalesInfo();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>⚖️ Электронные весы</h1>
        
        <div className="scales-info">
          <div className="total-weight">
            <h2>Общий вес: <span className="weight-value">{totalWeight.toFixed(2)} кг</span></h2>
            <p>Количество продуктов: {scales.getCount()}</p>
          </div>

          <div className="controls">
            <button onClick={handleAddApple} className="btn btn-apple">
              + Добавить яблоко
            </button>
            <button onClick={handleAddTomato} className="btn btn-tomato">
              + Добавить помидор
            </button>
            <button onClick={handleClearScales} className="btn btn-clear">
              🗑️ Очистить весы
            </button>
          </div>

          <div className="products-list">
            <h3>📋 Список продуктов на весах:</h3>
            <ul>
              {productList.map((productName, index) => (
                <li key={index}>{productName}</li>
              ))}
            </ul>
          </div>

          <div className="products-details">
            <h3>📊 Детальная информация:</h3>
            <table>
              <thead>
                <tr>
                  <th>Продукт</th>
                  <th>Вес (кг)</th>
                </tr>
              </thead>
              <tbody>
                {productsInfo.map((product, index) => (
                  <tr key={index}>
                    <td>{product.name}</td>
                    <td>{product.weight.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Итого:</strong></td>
                  <td><strong>{totalWeight.toFixed(2)} кг</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </header>
    </div>
  );
};

export default App;