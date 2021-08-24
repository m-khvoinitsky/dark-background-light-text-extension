import {
    methods as methods_bare,
    STYLESHEET_PROCESSOR_ID,
    INVERT_ID,
} from './methods';
import type { MethodsMetadataWithExecutors } from '../common/types';
import { StylesheetColorProcessor } from './executors/stylesheet-color-processor';
import { InvertMethod } from './executors/invert';

const methods = methods_bare as MethodsMetadataWithExecutors;

methods[STYLESHEET_PROCESSOR_ID].executor = StylesheetColorProcessor;
methods[INVERT_ID].executor = InvertMethod;

for (const k of Object.keys(methods)) {
    if (k !== STYLESHEET_PROCESSOR_ID && k !== INVERT_ID) {
        methods[k].executor = null;
    }
}

export { methods };
