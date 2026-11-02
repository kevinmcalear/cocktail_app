// The pages the beer and wine routes open (/beer/<id>, /wine/<id>, /add-beer,
// /add-wine). On phones they are part of the app; the web loads each from one
// shared chunk (KindRoutesLazy.web.tsx).
export { AddBeerWineRoute, type AddDrinkProps } from '@/components/screens/addBeerWine/AddBeerWineRoute';
export { BeerWineScreen } from './BeerWineScreen';
