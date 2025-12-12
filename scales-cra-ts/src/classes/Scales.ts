import { Product } from './Product';

export class Scales {
  private products: Product[] = [];

  // Добавить продукт на весы
  add(product: Product): void {
    this.products.push(product);
  }

  // Получить суммарный вес
  getSumScale(): number {    
    const totalWeight = this.products.reduce((sum, product) => {
      return sum + product.getScale();
    }, 0);    
    console.log(`getSumScale --- totalWeight: ${totalWeight}`);    
    return totalWeight;
  }

  // Получить список названий
  getNameList(): string[] {
    const names = this.products.map(product => product.getName());
    console.log(`getNameList --- names: ${names}`);    
    return names;
  }

  // Получить количество продуктов
  getCount(): number {
    return this.products.length;
  }

  // Очистить весы
  clear(): void {
    this.products = [];
  }

  // Получить информацию о всех продуктах
  getProductsInfo(): Array<{name: string, weight: number}> {
    return this.products.map(product => ({
      name: product.getName(),
      weight: product.getScale()
    }));
  }
}