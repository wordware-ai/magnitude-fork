import { Ingredient } from "./types";


export class Recipe {
    private ingredients: Ingredient[];
    
    constructor () {
        this.ingredients = [];
    }

    add(item: Ingredient) {
        this.ingredients.push(item);
    }

    getIngredients() {
        return this.ingredients;
    }
}