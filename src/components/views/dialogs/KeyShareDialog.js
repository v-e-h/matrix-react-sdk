/*
Copyright 2017 Vector Creations Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import Modal from '../../../Modal';
import {verifyDevice} from '../../../verification';
import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import * as sdk from '../../../index';

import { _t, _td } from '../../../languageHandler';

// TODO: We can remove this once cross-signing is the only way.
// https://github.com/vector-im/riot-web/issues/11908

/**
 * Dialog which asks the user whether they want to share their keys with
 * an unverified device.
 *
 * onFinished is called with `true` if the key should be shared, `false` if it
 * should not, and `undefined` if the dialog is cancelled. (In other words:
 * truthy: do the key share. falsy: don't share the keys).
 */
export default createReactClass({
    propTypes: {
        matrixClient: PropTypes.object.isRequired,
        userId: PropTypes.string.isRequired,
        deviceId: PropTypes.string.isRequired,
        onFinished: PropTypes.func.isRequired,
    },

    getInitialState: function() {
        return {
            deviceInfo: null,
            wasNewDevice: false,
        };
    },

    componentDidMount: function() {
        this._unmounted = false;
        const userId = this.props.userId;
        const deviceId = this.props.deviceId;

        // give the client a chance to refresh the device list
        this.props.matrixClient.downloadKeys([userId], false).then((r) => {
            if (this._unmounted) { return; }

            const deviceInfo = r[userId][deviceId];

            if (!deviceInfo) {
                console.warn(`No details found for session ${userId}:${deviceId}`);

                this.props.onFinished(false);
                return;
            }

            const wasNewDevice = !deviceInfo.isKnown();

            this.setState({
                deviceInfo: deviceInfo,
                wasNewDevice: wasNewDevice,
            });

            // if the device was new before, it's not any more.
            if (wasNewDevice) {
                this.props.matrixClient.setDeviceKnown(
                    userId,
                    deviceId,
                    true,
                );
            }
        });
    },

    componentWillUnmount: function() {
        this._unmounted = true;
    },


    _onVerifyClicked: async function() {
        const user = this.props.matrixClient.getUser(this.props.userId);
        if (user) {
            console.log("KeyShareDialog: Starting verify dialog");
            await verifyDevice(user, this.state.deviceInfo);
            const deviceTrust = this.props.matrixClient
                .checkDeviceTrust(this.props.userId, this.props.deviceId);
            this.props.onFinished(deviceTrust.isVerified());
        } else {
            console.log("KeyShareDialog: could not get user to verify for ", this.props.userId);
            this.props.onFinished(false);
        }
    },

    _onShareClicked: function() {
        console.log("KeyShareDialog: User clicked 'share'");
        this.props.onFinished(true);
    },

    _onIgnoreClicked: function() {
        console.log("KeyShareDialog: User clicked 'ignore'");
        this.props.onFinished(false);
    },

    _renderContent: function() {
        const displayName = this.state.deviceInfo.getDisplayName() ||
            this.state.deviceInfo.deviceId;

        let text;
        if (this.state.wasNewDevice) {
            text = _td("You added a new session '%(displayName)s', which is"
                + " requesting encryption keys.");
        } else {
            text = _td("Your unverified session '%(displayName)s' is requesting"
                + " encryption keys.");
        }
        text = _t(text, {displayName: displayName});

        return (
            <div id='mx_Dialog_content'>
                <p>{ text }</p>

                <div className="mx_Dialog_buttons">
                    <button onClick={this._onVerifyClicked} autoFocus="true">
                        { _t('Start verification') }
                    </button>
                    <button onClick={this._onShareClicked}>
                        { _t('Share without verifying') }
                    </button>
                    <button onClick={this._onIgnoreClicked}>
                        { _t('Ignore request') }
                    </button>
                </div>
            </div>
        );
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const Spinner = sdk.getComponent('views.elements.Spinner');

        let content;

        if (this.state.deviceInfo) {
            content = this._renderContent();
        } else {
            content = (
                <div id='mx_Dialog_content'>
                    <p>{ _t('Loading session info...') }</p>
                    <Spinner />
                </div>
            );
        }

        return (
            <BaseDialog className='mx_KeyShareRequestDialog'
                onFinished={this.props.onFinished}
                title={_t('Encryption key request')}
                contentId='mx_Dialog_content'
            >
                { content }
            </BaseDialog>
        );
    },
});
