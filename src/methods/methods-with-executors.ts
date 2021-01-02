import {
    methods as methods_bare,
    STYLESHEET_PROCESSOR_ID,
    INVERT_ID,
} from './methods';
import { MethodsMetadataWithExecutors } from '../common/types';
import { StylesheetColorProcessor } from './executors/stylesheet-color-processor';
import { InvertMethod } from './executors/invert';

let methods = methods_bare as MethodsMetadataWithExecutors;

methods[STYLESHEET_PROCESSOR_ID].executor = StylesheetColorProcessor
methods[INVERT_ID].executor = InvertMethod

for (let k in methods) {
    if (k !== STYLESHEET_PROCESSOR_ID && k !== INVERT_ID) {
        methods[k].executor = null
    }
}

export { methods };
