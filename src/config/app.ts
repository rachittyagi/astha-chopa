// Single source for the app's name and identifiers (R-I18N-03).
// Values live in app.json so app.config.ts can read them too; change the name
// there and rebuild to rename the app everywhere in-app.
import appConfig from './app.json';

export const APP_NAME: string = appConfig.name;
export const APP_SLUG: string = appConfig.slug;
export const APP_SCHEME: string = appConfig.scheme;
export const BUNDLE_ID: string = appConfig.bundleId;
