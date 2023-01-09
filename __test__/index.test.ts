import * as webpack                         from 'webpack';
import * as fs                              from 'fs';
import * as tmp                             from 'tmp';
import Loader, {IncludeError}               from 'multi-yaml-loader';
import {Schema}                             from "yaml/types";
import {MockLoaderContext}                  from './mock-loader';
import type {LoaderOptionsQuery}            from './mock-loader';

import LoaderContext = webpack.loader.LoaderContext;


export const createLoading = (file: string, options?: LoaderOptionsQuery) =>
    new Promise<string>(
        (resolve, reject) => {
            const ctx = new MockLoaderContext(file, resolve, reject, options || {});
            Loader.call(ctx as LoaderContext);
        }
    )
        .then(
            (moduleYamlString: string): any => {
                const tmpobj = tmp.fileSync();
                fs.writeSync(tmpobj.fd, moduleYamlString);
                const content: any = require(tmpobj.name);
                return content;
            }
        )
;

test(
    'no include',
    () => createLoading("documents/simple.yaml")
        .then(
            data => expect(data).toHaveProperty(
                'result',
                { name: 'simple' }
            )
        )
);

test(
    'with include',
    () => createLoading("documents/example.yaml")
        .then(
            data => expect(data).toHaveProperty(
                'result',
                { name: 'example', content: { name: 'simple' } }
            )
        )
);


test(
    'array include',
    () => createLoading("documents/array.yaml")
        .then(
            data => expect(data).toHaveProperty(
                'result',
                [{name:'item-1'},{name:'item-2'}]
            )
        )
);

test(
    'cycle include',
    () => createLoading("documents/cycle.yaml")
        .then(
            data => {
                expect(data.result === data.result.self).toEqual(true);
            }
        )
);


test(
    'not exists throws IncludeError',
    () => expect( createLoading("documents/not-exists.yaml") )
            .rejects.toThrow( IncludeError )
);


test(
    'broken include throws IncludeError',
    () =>   expect(
                createLoading("documents/broken.yaml")
            )
            .rejects.toThrow( IncludeError )
);


test(
    'relative',
    () => createLoading("./documents/path/to/inner/example.yaml")
            .then(
                data => {
                    expect(data.result.content.content.content.name).toEqual("simple");
                }
            )
);

test(
    'merge',
    () => createLoading("./documents/merge.yaml")
            .then(
                data => {
                    const {name, a, b, c} = data.result;
                    expect(name).toEqual("merge");
                    expect(a.name).toEqual("simple");
                    expect(a.value).toEqual(false);
                    expect(c.name).toEqual("merge");
                    expect(c.a.name).toEqual("simple");
                }
            )
);


test(
    '!yaml',
    () => createLoading("./documents/has-yaml-include.yaml")
            .then(
                data => {
                    const {name, content} = data.result;
                    expect(name).toEqual("has-yaml-include");
                    expect(content.name).toEqual("simple");
                }
            )
);

test(
    '!md',
    () => createLoading("./documents/has-md-include.yaml")
            .then(
                data => {
                    const {name, content} = data.result;
                    expect(name).toEqual("has-md-include");
                    expect(content).toMatchSnapshot("md-include-content");
                }
            )
);

test(
    '!json',
    () => createLoading("./documents/has-json-include.yaml")
            .then(
                data => {
                    const {name, content} = data.result;
                    expect(name).toEqual("has-json-include");
                    expect(content.name).toEqual("simple");
                }
            )
);

test(
    'custom-tags',
    () => createLoading(
        "./documents/has-custom-tags.yaml",
        {
            options: {
                customTags: [
                    ({
                        tag: '!custom',
                        identify:  () => true,
                        resolve: (doc, cst) => {
                            const value = 'strValue' in cst
                                ? (cst as {strValue: any} ).strValue
                                : ''
                            ;
                            return `custom[${value}]`;
                        }
                    }) as Schema.CustomTag
                ]
            }
        }
    )
            .then(
                data => {
                    const {name, content} = data.result;
                    expect(name).toEqual("has-custom-tags");
                    expect(content).toEqual("custom[custom content]");
                }
            )
);
